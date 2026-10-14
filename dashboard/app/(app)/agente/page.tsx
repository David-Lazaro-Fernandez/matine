'use client';

// Asistente: una conversación con el agente (`POST /api/agente/preguntar`). Cada respuesta trae las herramientas que
// consultó, que "Ver detalle" muestra en español.
import * as React from 'react';
import { Body1, Button, Caption1, MessageBar, MessageBarBody, Spinner, Textarea, makeStyles, tokens } from '@fluentui/react-components';
import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  Copy20Regular,
  Send20Regular,
  ThumbDislike20Filled,
  ThumbDislike20Regular,
  ThumbLike20Filled,
  ThumbLike20Regular,
} from '@fluentui/react-icons';
import { PageHeader } from '@/components/common';
import { ApiError, api } from '@/lib/api';
import { fill } from '@/lib/format';
import { AGENT_TOOL_LABEL, AGENT_UI, NAV_LABEL } from '@/lib/labels.generated';

type ToolUse = { name: string; arguments: Record<string, unknown> | null; rows: number | null; ms: number };
type Answer = { conversation_id: number; message_id: number; answer: string; tools: ToolUse[] };
type Message = { role: 'user' | 'assistant'; text: string; id?: number; tools?: ToolUse[]; useful?: boolean };

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
  assistant: { maxWidth: '80%', whiteSpace: 'pre-wrap' },
  actions: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXS },
  detail: { margin: `${tokens.spacingVerticalXS} 0 0`, paddingLeft: tokens.spacingHorizontalL, color: tokens.colorNeutralForeground3 },
  composer: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'flex-end' },
  input: { flexGrow: 1 },
});

function Reply({ message }: { message: Message }) {
  const s = useStyles();
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
      <Body1>{message.text}</Body1>
      <div className={s.actions}>
        <Button appearance="subtle" size="small" aria-label={AGENT_UI.useful} aria-pressed={useful === true}
                icon={useful === true ? <ThumbLike20Filled /> : <ThumbLike20Regular />} onClick={() => vote(true)} />
        <Button appearance="subtle" size="small" aria-label={AGENT_UI.not_useful} aria-pressed={useful === false}
                icon={useful === false ? <ThumbDislike20Filled /> : <ThumbDislike20Regular />} onClick={() => vote(false)} />
        <Button appearance="subtle" size="small" icon={<Copy20Regular />} onClick={copy}>
          {copied ? AGENT_UI.copied : AGENT_UI.copy}
        </Button>
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
  const [error, setError] = React.useState<string | null>(null);

  const send = async () => {
    const question = text.trim();
    if (!question || busy) return;
    setText('');
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: question }]);
    try {
      const out = await api<Answer>('/agente/preguntar', { question, conversation_id: conversation });
      setConversation(out.conversation_id);
      setMessages((m) => [...m, { role: 'assistant', text: out.answer, id: out.message_id, tools: out.tools }]);
    } catch (e) {
      setError((e instanceof ApiError && e.detail) || AGENT_UI.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={NAV_LABEL.agente}>
        {messages.length > 0 && (
          <Button appearance="subtle" onClick={() => { setMessages([]); setConversation(null); setError(null); }}>
            {AGENT_UI.new_chat}
          </Button>
        )}
      </PageHeader>
      <div className={s.thread}>
        {messages.map((m, i) => (m.role === 'user'
          ? <div key={i} className={s.user}><Body1>{m.text}</Body1></div>
          : <Reply key={i} message={m} />))}
        {busy && <Spinner size="tiny" labelPosition="after" label={AGENT_UI.thinking} />}
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      </div>
      <div className={s.composer}>
        <Textarea
          className={s.input}
          aria-label={AGENT_UI.placeholder}
          placeholder={AGENT_UI.placeholder}
          value={text}
          maxLength={2000}
          resize="vertical"
          onChange={(_, d) => setText(d.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button appearance="primary" icon={<Send20Regular />} disabled={busy || !text.trim()} onClick={send}>
          {AGENT_UI.send}
        </Button>
      </div>
    </>
  );
}
