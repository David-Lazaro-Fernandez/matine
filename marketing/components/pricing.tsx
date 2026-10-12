'use client';

import { useState } from 'react';
import { DEMO_URL } from '@/lib/site';
import { Arrow } from './icons';
import { Reveal } from './reveal';

// Sin precio en ningún plan (decisión 2026-10-12): cada botón lleva a /request-demo/.
// Lo marcado con `soon` no existe hoy y se rotula como puerta falsa (design.md §3).

type Item = { text: string; soon?: string };
type Plan = { key: string; name: string; who: string; inherits?: string; items: Item[]; recommended?: boolean };

const PLANS: Plan[] = [
  {
    key: 'plan-esencial',
    name: 'Esencial',
    who: 'Para una cadena que sigue a su competencia en una plaza.',
    items: [
      { text: 'Cartelera: hallazgos, programación semanal, preventa, precios y butacas, cines e historial de funciones' },
      { text: 'Mapa de cines y cine independiente' },
      { text: 'Puestos de Analista y de Lector' },
      { text: 'Un administrador y el logo de tu cadena' },
    ],
  },
  {
    key: 'plan-profesional',
    name: 'Profesional',
    who: 'Para una cadena que compara en varias plazas.',
    inherits: 'Esencial',
    recommended: true,
    items: [
      { text: 'Dulcería: precios por cine y en apps de entrega' },
      { text: 'Varios administradores' },
      { text: 'Vistas propias que el Analista guarda y comparte', soon: 'Próximamente' },
      { text: 'Resumen del lunes narrado con IA', soon: 'Próximamente' },
    ],
  },
  {
    key: 'plan-enterprise',
    name: 'Enterprise',
    who: 'Para una cadena nacional o un grupo de exhibición.',
    inherits: 'Profesional',
    items: [
      { text: 'Datos: el archivo histórico completo, con descarga' },
      { text: '15 puestos para empezar; puestos y módulos se negocian' },
      { text: 'Registro de accesos y cambios de cada cuenta' },
      { text: 'Tus precios y ventas en Excel o CSV, comparados con el mercado', soon: 'Próximamente' },
      { text: 'Inicio de sesión único (SSO)', soon: 'Próximamente' },
      { text: 'Agente de alertas de cartelera', soon: 'En evaluación' },
    ],
  },
];

const AUDIENCES = ['Cadenas', 'Distribuidoras'] as const;

const SEATS = [
  { name: 'Analista', does: 'Ve, filtra y descarga los datos. Con las vistas propias, también las crea y las comparte.' },
  { name: 'Lector', does: 'Ve y filtra todas las páginas de los módulos contratados.' },
  { name: 'Administrador', does: 'Invita y da de baja cuentas, asigna puestos y sube el logo. Ocupa el primer puesto.' },
];

// Una fila por diferencia entre planes; `true` es incluido, un texto es incluido con matiz.
type Cell = boolean | string;
const COMPARISON: [string, [string, Cell, Cell, Cell][]][] = [
  [
    'Módulos',
    [
      ['Cartelera', true, true, true],
      ['Mapa y cine independiente', true, true, true],
      ['Dulcería', false, true, true],
      ['Datos', false, false, true],
    ],
  ],
  [
    'Puestos',
    [
      ['Analista y Lector', true, true, true],
      ['Puestos para empezar', false, false, '15'],
    ],
  ],
  [
    'Herramientas',
    [
      ['Filtros por plaza, periodo y franja', true, true, true],
      ['Vistas propias compartidas', false, 'Próximamente', 'Próximamente'],
      ['Tus datos contra el mercado', false, false, 'Próximamente'],
    ],
  ],
  [
    'Administración',
    [
      ['Administrador y logo', true, true, true],
      ['Varios administradores', false, true, true],
      ['Registro de accesos', false, false, true],
      ['SSO', false, false, 'Próximamente'],
    ],
  ],
  [
    'Complementos',
    [
      ['Resumen narrado con IA', false, 'Próximamente', 'Próximamente'],
      ['Agente de alertas', false, false, 'En evaluación'],
    ],
  ],
  [
    'Facturación',
    [['Mensual o anual', true, true, true]],
  ],
];

const CHOOSE = [
  { q: '¿En cuántas plazas compites?', a: 'Una plaza cabe en Esencial. Varias, en Profesional.' },
  { q: '¿Tu equipo revisa la dulcería?', a: 'Dulcería empieza en Profesional.' },
  { q: '¿Necesitas el histórico o cargar tus datos?', a: 'Datos y la carga de tus datos van en Enterprise.' },
];

const FAQ = [
  {
    q: '¿Qué es un puesto?',
    a: 'La licencia de una persona con nombre y correo. Cada puesto es de Analista o de Lector; el administrador ocupa el primero.',
  },
  {
    q: '¿Qué pasa si agrego personas a mitad del contrato?',
    a: 'Se agregan puestos al contrato vigente. Cómo se cobran lo acordamos al firmar.',
  },
  {
    q: '¿Puedo contratar un solo módulo?',
    a: 'Cartelera es la base de cualquier plan. Los demás módulos se suman por plan o se negocian en Enterprise.',
  },
  {
    q: '¿Cada cuánto se actualiza el dato?',
    a: 'La cartelera se captura tres veces al día, a las 07:30, 13:30 y 20:30. Los planos de asientos, cada hora en las plazas del piloto.',
  },
  {
    q: '¿Qué plazas cubre?',
    a: 'Capturamos los cines de los 32 estados y comparamos dentro de Ciudad de México, Guadalajara y Monterrey.',
  },
  {
    q: '¿Cómo se factura?',
    a: 'Por puesto, mes a mes o por año adelantado, según lo que necesite tu cadena.',
  },
  {
    q: '¿Quién ve la información de mi cadena?',
    a: 'Solo las cuentas de tu organización. El dato del mercado es lo que cada cadena publica; lo que tu equipo carga no se comparte con nadie.',
  },
];

function Mark({ value }: { value: Cell }) {
  if (value === true) return <span className="price-table__yes">Incluido</span>;
  if (value === false) return <span className="price-table__no">—</span>;
  return <span className={value.startsWith('Próx') || value.startsWith('En ') ? 'ai__status' : ''}>{value}</span>;
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={`plan ${plan.recommended ? 'plan--recommended' : ''}`}>
      <div className="plan__head">
        <h3 className="plan__name">{plan.name}</h3>
        {plan.recommended && <span className="plan__badge">Recomendado</span>}
      </div>
      <p className="plan__who">{plan.who}</p>
      <a className={`pill ${plan.recommended ? 'pill--primary' : 'pill--ghost'}`} href={DEMO_URL}>
        Contactar ventas
        <Arrow />
      </a>
      {plan.inherits && <p className="plan__inherits">Todo lo de {plan.inherits}, más:</p>}
      <ul className="plan__items">
        {plan.items.map((item) => (
          <li key={item.text}>
            {item.text}
            {item.soon && <span className="ai__status">{item.soon}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pricing() {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>('Cadenas');

  return (
    <>
      <section className="section price-hero">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Precios</span>
            <h1 className="display">
              Pagas por módulos y por puestos.
              <br />
              <span className="muted">Mensual o anual.</span>
            </h1>
          </Reveal>

          <div className="rec-tabs price-tabs" role="tablist">
            {AUDIENCES.map((a) => (
              <button
                key={a}
                role="tab"
                aria-selected={audience === a}
                className={`rec-tabs__tab ${audience === a ? 'is-on' : ''}`}
                onClick={() => setAudience(a)}
              >
                {a}
              </button>
            ))}
          </div>

          {audience === 'Cadenas' ? (
            <div className="plans">
              {PLANS.map((p) => (
                <PlanCard key={p.key} plan={p} />
              ))}
            </div>
          ) : (
            <div className="plan plan--single">
              <span className="ai__status">En evaluación</span>
              <h3 className="plan__name">Distribuidoras</h3>
              <p className="plan__who">
                Dónde se programa cada una de tus películas, cuántas funciones y salas recibe en cada cadena, su
                preventa, su ocupación y su precio.
              </p>
              <a className="pill pill--primary" href={DEMO_URL}>
                Contactar ventas
                <Arrow />
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="section section--border">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Puestos</span>
            <h2 className="display">¿Qué es un puesto?</h2>
          </Reveal>
          <div className="hgrid">
            {SEATS.map((s) => (
              <div key={s.name} className="hgrid__cell">
                <h3 className="hgrid__title">{s.name}</h3>
                <p className="hgrid__text">{s.does}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Comparación</span>
            <h2 className="display">Plan por plan.</h2>
          </Reveal>
          <div className="price-table">
            <table>
              <thead>
                <tr>
                  <th />
                  {PLANS.map((p) => (
                    <th key={p.key}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              {COMPARISON.map(([group, rows]) => (
                <tbody key={group}>
                  <tr className="price-table__group">
                    <th colSpan={4}>{group}</th>
                  </tr>
                  {rows.map(([label, ...cells]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      {cells.map((c, i) => (
                        <td key={i}>
                          <Mark value={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      <section className="section section--border">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Ayuda para elegir</span>
            <h2 className="display">Tres preguntas.</h2>
          </Reveal>
          <div className="hgrid">
            {CHOOSE.map((c, i) => (
              <div key={c.q} className="hgrid__cell">
                <span className="hgrid__idx">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="hgrid__title">{c.q}</h3>
                <p className="hgrid__text">{c.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--border">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Preguntas frecuentes</span>
          </Reveal>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q} className="faq__item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
