'use client';

// Asistente: una conversación con el agente (`POST /api/agente/preguntar`). Cada respuesta trae las herramientas que
// consultó, que "Ver detalle" muestra en español.
import * as React from 'react';
import { Body1, Button, Caption1, MessageBar, MessageBarBody, Textarea, Title3, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import {
  ArrowRight20Regular,
  ArrowSwap20Regular,
  BuildingMultiple20Regular,
  BuildingShop20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Copy20Regular,
  DataBarVertical20Regular,
  Database20Regular,
  Open20Regular,
  ThumbDislike20Filled,
  ThumbDislike20Regular,
  ThumbLike20Filled,
  ThumbLike20Regular,
} from '@fluentui/react-icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { notifyHistory } from '@/components/agente/chat-history';
import { PageHeader } from '@/components/common';
import { Markdown } from '@/components/markdown';
import { ApiError, api, apiStream, query } from '@/lib/api';
import { fill } from '@/lib/format';
import { AGENT_SUGGESTIONS, AGENT_TOOL_LABEL, AGENT_UI, NAV_LABEL } from '@/lib/labels.generated';

type Source = Record<string, string>;
type ToolUse = { name: string; arguments: Record<string, unknown> | null; rows: number | null; ms: number; sources: Source[] };
type Answer = { conversation_id: number; message_id: number; answer: string; tools: ToolUse[] };
type StoredMessage = { id: number; role: 'user' | 'assistant'; content: string; tools: ToolUse[] | null; useful: boolean | null };
type Message = { role: 'user' | 'assistant'; text: string; id?: number; tools?: ToolUse[]; useful?: boolean; fresh?: boolean };
type StreamEvent =
  | { event: 'step'; step: 'scope' | 'tool' | 'review'; name?: string }
  | ({ event: 'answer' } & Answer)
  | { event: 'error'; status: number; detail: string };

// Palabras que aparecen por tick al mostrar una respuesta nueva, y cada cuántos milisegundos.
const REVEAL_WORDS = 3;
const REVEAL_MS = 30;
// Milisegundos entre letras cuando un ejemplo se escribe solo en la caja.
const TYPE_MS = 8;

// El texto de una respuesta recién llegada, revelado de a poco. Una respuesta del historial o con movimiento reducido sale entera.
function useReveal(text: string, animate: boolean): string {
  const words = React.useMemo(() => text.split(/(\s+)/), [text]);
  const [count, setCount] = React.useState(animate ? 0 : words.length);
  React.useEffect(() => {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(words.length);
      return;
    }
    const timer = setInterval(() => setCount((c) => Math.min(words.length, c + REVEAL_WORDS * 2)), REVEAL_MS);
    return () => clearInterval(timer);
  }, [animate, words]);
  return words.slice(0, count).join('');
}

const useStyles = makeStyles({
  thread: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalL },
  user: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusLarge,
    whiteSpace: 'pre-wrap',
  },
  assistant: { maxWidth: '80%' },
  thinking: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3 },
  dots: { display: 'inline-flex', gap: '4px' },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
    animationName: { '0%, 80%, 100%': { opacity: 0.25, transform: 'scale(0.8)' }, '40%': { opacity: 1, transform: 'scale(1)' } },
    animationDuration: '1.2s',
    animationIterationCount: 'infinite',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none', opacity: 0.6 },
  },
  dotSecond: { animationDelay: '0.2s' },
  dotThird: { animationDelay: '0.4s' },
  actions: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXS },
  detail: { margin: `${tokens.spacingVerticalXS} 0 0`, paddingLeft: tokens.spacingHorizontalL, color: tokens.colorNeutralForeground3 },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXL,
    maxWidth: '760px',
    margin: '0 auto',
    paddingTop: '8vh',
    '@media (max-width: 768px)': { paddingTop: tokens.spacingVerticalL },
  },
  title: { textAlign: 'center' },
  // En escritorio el panel izquierdo ya tiene este botón.
  newChat: { '@media (min-width: 769px)': { display: 'none' } },
  composer: {
    position: 'relative',
    width: '100%',
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ':focus-within': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      boxShadow: tokens.shadow16,
    },
  },
  composerLarge: { minHeight: '140px' },
  field: {
    width: '100%',
    '::after': { display: 'none' },
    backgroundColor: 'transparent',
    // Deja sitio al botón de enviar, que flota en la esquina.
    '& textarea': { padding: `${tokens.spacingVerticalM} 64px ${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`, resize: 'none' },
  },
  fieldLarge: { '& textarea': { minHeight: '120px' } },
  send: { position: 'absolute', right: tokens.spacingHorizontalM, bottom: tokens.spacingVerticalM },
  chip: {
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    ':active': { backgroundColor: tokens.colorNeutralBackground1Pressed },
  },
  suggestions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: tokens.spacingHorizontalS },
});

const SUGGESTION_ICON: Record<string, React.ComponentType> = {
  screens: DataBarVertical20Regular,
  sales: BuildingMultiple20Regular,
  rival: ArrowSwap20Regular,
  snacks: BuildingShop20Regular,
  tables: Database20Regular,
};

function Composer({ text, onText, busy, onSend, large, inputRef }: {
  text: string; onText: (value: string) => void; busy: boolean; onSend: () => void; large?: boolean;
  inputRef: React.Ref<HTMLTextAreaElement>;
}) {
  const s = useStyles();
  return (
    <div className={mergeClasses(s.composer, large && s.composerLarge)}>
      <Textarea
        ref={inputRef}
        className={mergeClasses(s.field, large && s.fieldLarge)}
        // Los bordes de Fluent ganan a las clases: la caja ya dibuja el borde y el foco.
        style={{ border: 'none' }}
        aria-label={AGENT_UI.placeholder}
        placeholder={AGENT_UI.placeholder}
        value={text}
        maxLength={2000}
        resize="none"
        onChange={(_, d) => onText(d.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
      />
      <Button className={s.send} appearance="primary" shape="circular" icon={<ArrowRight20Regular />}
              aria-label={AGENT_UI.send} disabled={busy || !text.trim()} onClick={onSend} />
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  const s = useStyles();
  return (
    <div className={s.thinking} role="status">
      <span className={s.dots} aria-hidden>
        <span className={s.dot} />
        <span className={mergeClasses(s.dot, s.dotSecond)} />
        <span className={mergeClasses(s.dot, s.dotThird)} />
      </span>
      <Caption1>{label}</Caption1>
    </div>
  );
}

// Los datos que respaldan una respuesta, como enlaces al explorador de Datos con la misma consulta. Sin repetidos.
function sourceLinks(tools: ToolUse[] | undefined): { href: string; search?: string }[] {
  const links = new Map<string, { href: string; search?: string }>();
  for (const source of (tools ?? []).flatMap((t) => t.sources ?? [])) {
    const href = `/datos/${query(source)}`;
    links.set(href, { href, search: source.search });
  }
  return [...links.values()];
}

function Reply({ message }: { message: Message }) {
  const s = useStyles();
  const links = sourceLinks(message.tools);
  const shown = useReveal(message.text, message.fresh === true);
  const [useful, setUseful] = React.useState<boolean | undefined>(message.useful);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const vote = (value: boolean) => {
    setUseful(value);
    api(`/agente/mensajes/${message.id}/pulgar`, { useful: value }).catch(() => setUseful(undefined));
  };
  const copy = () => {
    navigator.clipboard.writeText(message.text).then(() => setCopied(true));
  };
  return (
    <div className={s.assistant}>
      <Markdown>{shown}</Markdown>
      <div className={s.actions}>
        <Button appearance="subtle" size="small" aria-label={AGENT_UI.useful} aria-pressed={useful === true}
                icon={useful === true ? <ThumbLike20Filled /> : <ThumbLike20Regular />} onClick={() => vote(true)} />
        <Button appearance="subtle" size="small" aria-label={AGENT_UI.not_useful} aria-pressed={useful === false}
                icon={useful === false ? <ThumbDislike20Filled /> : <ThumbDislike20Regular />} onClick={() => vote(false)} />
        <Button appearance="subtle" size="small" icon={<Copy20Regular />} onClick={copy}>
          {copied ? AGENT_UI.copied : AGENT_UI.copy}
        </Button>
        {links.map((link) => (
          <Button key={link.href} as="a" href={link.href} target="_blank" rel="noopener" appearance="subtle" size="small" icon={<Open20Regular />}>
            {links.length > 1 && link.search ? `${AGENT_UI.see_more} · ${link.search}` : AGENT_UI.see_more}
          </Button>
        ))}
        {message.tools && message.tools.length > 0 && (
          <Button appearance="subtle" size="small" icon={open ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                  onClick={() => setOpen(!open)}>
            {open ? AGENT_UI.hide_detail : AGENT_UI.show_detail}
          </Button>
        )}
      </div>
      {open && (
        <ul className={s.detail}>
          {message.tools?.map((t, i) => (
            <li key={i}>
              <Caption1>
                {AGENT_TOOL_LABEL[t.name as keyof typeof AGENT_TOOL_LABEL] ?? t.name}
                {t.rows != null && ` · ${fill(AGENT_UI.detail_rows, { rows: t.rows })}`}
              </Caption1>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page() {
  const s = useStyles();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [conversation, setConversation] = React.useState<number | null>(null);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<string>(AGENT_UI.step_scope);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const requested = useSearchParams().get('c');
  const typing = React.useRef<number | undefined>(undefined);

  const stopTyping = () => window.clearInterval(typing.current);
  React.useEffect(() => stopTyping, []);

  // La conversación abierta vive en la URL: `?c=` la reabre y quitarlo empieza una nueva. Al contestar por primera vez la
  // conversación ya está en el estado, así que el cambio de URL no la vuelve a pedir.
  React.useEffect(() => {
    const id = requested ? Number(requested) : null;
    if (id === conversation || busy) return;
    stopTyping();
    setError(null);
    if (id === null) {
      setMessages([]);
      setConversation(null);
      return;
    }
    let live = true;
    api<StoredMessage[]>(`/agente/conversaciones/${id}`).then(
      (found) => {
        if (!live) return;
        if (found.length === 0) return router.replace('/agente/');
        setConversation(id);
        setMessages(found.map((m) => ({ role: m.role, text: m.content, id: m.id, tools: m.tools ?? undefined, useful: m.useful ?? undefined })));
      },
      () => live && router.replace('/agente/'),
    );
    return () => { live = false; };
    // Solo la URL decide qué conversación se abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  // Borra la caja y escribe `example` letra por letra. Un ejemplo nuevo, una tecla o enviar cortan el anterior.
  const typeOut = (example: string) => {
    stopTyping();
    setText('');
    input.current?.focus();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(example);
      return;
    }
    let letters = 0;
    typing.current = window.setInterval(() => {
      letters += 1;
      setText(example.slice(0, letters));
      if (letters >= example.length) stopTyping();
    }, TYPE_MS);
  };

  const send = async () => {
    const question = text.trim();
    if (!question || busy) return;
    stopTyping();
    setText('');
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setStep(AGENT_UI.step_scope);
    try {
      await apiStream<StreamEvent>('/agente/preguntar/flujo', { question, conversation_id: conversation }, (e) => {
        if (e.event === 'step') {
          setStep(e.step === 'scope' ? AGENT_UI.step_scope : e.step === 'review' ? AGENT_UI.step_review : AGENT_UI.thinking);
        } else if (e.event === 'answer') {
          setConversation(e.conversation_id);
          setMessages((m) => [...m, { role: 'assistant', text: e.answer, id: e.message_id, tools: e.tools, fresh: true }]);
          if (requested === null) router.replace(`/agente/?c=${e.conversation_id}`);
          notifyHistory();
        } else {
          setError(e.detail || AGENT_UI.error);
        }
      });
    } catch (e) {
      setError((e instanceof ApiError && e.detail) || AGENT_UI.error);
    } finally {
      setBusy(false);
    }
  };

  const composer = (large?: boolean) => (
    <Composer text={text} onText={(value) => { stopTyping(); setText(value); }} busy={busy} onSend={send} large={large} inputRef={input} />
  );

  if (messages.length === 0 && !busy) {
    return (
      <div className={s.hero}>
        <Title3 as="h1" className={s.title}>{AGENT_UI.title}</Title3>
        {composer(true)}
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        <div className={s.suggestions}>
          <Caption1>{AGENT_UI.try_with}</Caption1>
          {AGENT_SUGGESTIONS.map(({ key, label, question }) => {
            const Icon = SUGGESTION_ICON[key];
            return (
              <Button key={key} className={s.chip} shape="circular" appearance="outline" icon={<Icon />}
                      onClick={() => typeOut(question)}>
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={NAV_LABEL.agente}>
        <Button className={s.newChat} appearance="subtle" onClick={() => router.push('/agente/')}>
          {AGENT_UI.new_chat}
        </Button>
      </PageHeader>
      <div className={s.thread}>
        {messages.map((m, i) => (m.role === 'user'
          ? <div key={i} className={s.user}><Body1>{m.text}</Body1></div>
          : <Reply key={i} message={m} />))}
        {busy && <Thinking label={step} />}
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      </div>
      {composer()}
    </>
  );
}
