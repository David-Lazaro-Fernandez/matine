"""Administración de cuentas y organizaciones desde la línea de comandos (así se crea el primer admin y el staff).

Uso: .venv/bin/python -m auth.cli create --email E --name N [--role staff|admin|analyst|viewer] [--org ID] [--no-mail]
                               | list | reset --email E | deactivate --email E | activate --email E
                               | role --email E --role R | org-create --name N --modules a,b|completo
                               | org-modules --org ID --modules a,b|completo | org-list | prune
                               | org-integrations --org ID [--slack-webhook URL] [--digest-to a@x,b@y]
Siempre imprime el enlace además de enviarlo por correo; con AC_MAIL_BACKEND=console también queda en
data/logs/mail.log. `role` es la única forma de dar el rol `staff`. Sale con 1 en error.
"""
import argparse
import sys

from . import flows, orgs, sessions, users
from .db import DEFAULT_ORG_ID, MODULES, connect
from .errors import AuthError

# Nombre comercial del plan con todos los módulos.
_FULL_PLAN = "completo"


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m auth.cli", description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("create", help="cuenta nueva con enlace de invitación")
    p.add_argument("--email", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--role", choices=orgs.ROLES, default="viewer")
    p.add_argument("--org", type=int, default=DEFAULT_ORG_ID, help="id de la organización (org-list)")
    p.add_argument("--no-mail", action="store_true", help="no envía correo; solo imprime el enlace")
    sub.add_parser("list", help="todas las cuentas")
    for cmd, help_ in (("reset", "enlace nuevo de restablecimiento o invitación"),
                       ("deactivate", "desactiva la cuenta y cierra sus sesiones"),
                       ("activate", "reactiva la cuenta"),
                       ("role", "cambia el rol de la cuenta")):
        p = sub.add_parser(cmd, help=help_)
        p.add_argument("--email", required=True)
        if cmd == "reset":
            p.add_argument("--no-mail", action="store_true")
        if cmd == "role":
            p.add_argument("--role", choices=orgs.ROLES, required=True)
    p = sub.add_parser("org-create", help="organización nueva con los módulos que contrató")
    p.add_argument("--name", required=True)
    p.add_argument("--modules", type=_modules, required=True, help=f"{','.join(MODULES)} o {_FULL_PLAN}")
    p = sub.add_parser("org-modules", help="cambia los módulos de una organización")
    p.add_argument("--org", type=int, required=True)
    p.add_argument("--modules", type=_modules, required=True, help=f"{','.join(MODULES)} o {_FULL_PLAN}")
    p = sub.add_parser("org-integrations", help="avisos de Slack y destinatarios del resumen de una organización")
    p.add_argument("--org", type=int, required=True)
    p.add_argument("--slack-webhook", help="URL de webhook de Slack; cadena vacía la quita")
    p.add_argument("--digest-to", help="correos separados por coma; cadena vacía los quita")
    sub.add_parser("org-list", help="todas las organizaciones")
    sub.add_parser("prune", help="borra sesiones y tokens vencidos hace más de 90 días")
    args = ap.parse_args(argv)

    with connect() as conn:
        try:
            return _run(conn, args)
        except AuthError as e:
            print(f"error: {type(e).__name__} {e}", file=sys.stderr)
            return 1


def _modules(text):
    """'cartelera,dulceria' → ['cartelera', 'dulceria']; 'completo' → todos los de `MODULES`."""
    if text.strip().lower() == _FULL_PLAN:
        return list(MODULES)
    modules = [m.strip() for m in text.split(",") if m.strip()]
    unknown = set(modules) - set(MODULES)
    if unknown:
        raise argparse.ArgumentTypeError(f"módulos desconocidos: {', '.join(sorted(unknown))}")
    return modules


def _run(conn, args):
    if args.cmd == "create":
        if args.org not in {o["id"] for o in orgs.list_orgs(conn)}:
            print(f"error: no hay organización {args.org}", file=sys.stderr)
            return 1
        user, link = flows.invite(conn, None, args.email, args.name, args.role, send_mail=not args.no_mail,
                                  org_id=args.org)
        print(f"cuenta {user['id']} {user['email']} ({user['role']}, organización {user['org_id']})\nenlace: {link}")
    elif args.cmd == "list":
        for u in users.list_users(conn):
            state = "activa" if u["active"] else "inactiva"
            extra = " · invitación pendiente" if u["pending_invite"] else ("" if u["has_password"] else " · sin contraseña")
            last = u["last_login_at"].strftime("%Y-%m-%d %H:%M") if u["last_login_at"] else "nunca"
            print(f"{u['id']:>4}  {u['email']:<40} {u['role']:<7} org {u['org_id']:<3} {state:<9} "
                  f"último acceso: {last}{extra}")
    elif args.cmd == "org-create":
        org = orgs.create(conn, args.name, args.modules)
        print(f"organización {org['id']} {org['name']}: {', '.join(org['modules'])}")
    elif args.cmd == "org-modules":
        if not orgs.set_modules(conn, args.org, args.modules):
            print(f"error: no hay organización {args.org}", file=sys.stderr)
            return 1
        print(f"organización {args.org}: {', '.join(args.modules) or 'sin módulos'}")
    elif args.cmd == "org-integrations":
        changes = {}
        if args.slack_webhook is not None:
            changes["slack_webhook"] = args.slack_webhook
        if args.digest_to is not None:
            changes["digest_recipients"] = args.digest_to.split(",")
        try:
            orgs.set_settings(conn, args.org, changes)
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        settings = orgs.integrations(conn, args.org)
        print(f"organización {args.org}: slack {'sí' if settings.get('slack_webhook') else 'no'}, "
              f"resumen a {len(settings.get('digest_recipients') or [])} correos")
    elif args.cmd == "org-list":
        for org in orgs.list_orgs(conn):
            print(f"{org['id']:>4}  {org['name']:<30} {', '.join(org['modules']) or 'sin módulos'}")
    elif args.cmd == "prune":
        n_sessions, n_tokens = sessions.prune(conn)
        print(f"borradas {n_sessions} sesiones y {n_tokens} tokens")
    else:
        user = users.by_email(conn, args.email)
        if user is None:
            print(f"error: no hay cuenta con {args.email}", file=sys.stderr)
            return 1
        if args.cmd == "reset":
            print(f"enlace: {flows.resend(conn, None, user['id'], send_mail=not args.no_mail)}")
        elif args.cmd == "deactivate":
            flows.deactivate(conn, None, user["id"])
            print(f"{user['email']} desactivada")
        elif args.cmd == "activate":
            flows.activate(conn, None, user["id"])
            print(f"{user['email']} activada")
        elif args.cmd == "role":
            flows.set_role(conn, None, user["id"], args.role)
            print(f"{user['email']}: {args.role}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
