'use client';

// Centro de ayuda: el botón "?" de la barra superior abre un panel a la derecha con los temas de `HELP_TOPICS`.
// Sin búsqueda se ven los temas; un tema muestra sus guías y una guía, sus pasos. La búsqueda lista guías de todos los temas.
import * as React from 'react';
import {
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Input,
  OverlayDrawer,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowLeft20Regular,
  ChevronRight20Regular,
  Dismiss24Regular,
  QuestionCircle24Regular,
  Search20Regular,
} from '@fluentui/react-icons';
import { normalize } from '@/components/command-palette';
import { HELP_TEXT, HELP_TOPICS } from '@/lib/labels.generated';

type Guide = { key: string; title: string; summary: string; steps?: readonly string[] };
type Topic = { key: string; title: string; summary: string; guides: readonly Guide[] };
const TOPICS: readonly Topic[] = HELP_TOPICS;

const useStyles = makeStyles({
  body: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalXL },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    width: '100%',
    padding: tokens.spacingHorizontalM,
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  cardText: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 },
  cardTitle: { fontWeight: tokens.fontWeightSemibold },
  muted: { color: tokens.colorNeutralForeground3 },
  steps: { margin: 0, paddingLeft: tokens.spacingHorizontalXL, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
});

function guideMatches(guide: Guide, query: string): boolean {
  const haystack = normalize(`${guide.title} ${guide.summary} ${guide.steps?.join(' ') ?? ''}`);
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

function Card({ title, summary, onClick }: { title: string; summary: string; onClick: () => void }) {
  const s = useStyles();
  return (
    <button type="button" className={s.card} onClick={onClick}>
      <span className={s.cardText}>
        <Text className={s.cardTitle}>{title}</Text>
        <Text size={200} className={s.muted}>{summary}</Text>
      </span>
      <ChevronRight20Regular />
    </button>
  );
}

export function HelpDrawer() {
  const s = useStyles();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [topic, setTopic] = React.useState<Topic | null>(null);
  const [guide, setGuide] = React.useState<Guide | null>(null);

  const back = () => (guide ? setGuide(null) : setTopic(null));
  const pickGuide = (g: Guide) => { setGuide(g); setQuery(''); };
  const found = query.trim() ? TOPICS.flatMap((t) => t.guides).filter((g) => guideMatches(g, query)) : null;

  const content = () => {
    if (guide) {
      return (
        <>
          <Text size={500} weight="semibold" as="h2">{guide.title}</Text>
          <Text>{guide.summary}</Text>
          {guide.steps && <ol className={s.steps}>{guide.steps.map((step) => <li key={step}><Text>{step}</Text></li>)}</ol>}
        </>
      );
    }
    if (found) {
      return found.length
        ? found.map((g) => <Card key={g.key} title={g.title} summary={g.summary} onClick={() => pickGuide(g)} />)
        : <Text className={s.muted}>{HELP_TEXT.no_results}</Text>;
    }
    if (topic) return topic.guides.map((g) => <Card key={g.key} title={g.title} summary={g.summary} onClick={() => pickGuide(g)} />);
    return TOPICS.map((t) => <Card key={t.key} title={t.title} summary={t.summary} onClick={() => setTopic(t)} />);
  };

  return (
    <>
      <Tooltip content={HELP_TEXT.open} relationship="label">
        <Button appearance="subtle" icon={<QuestionCircle24Regular />} onClick={() => setOpen(true)} />
      </Tooltip>
      <OverlayDrawer position="end" size="small" open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DrawerHeader>
          <DrawerHeaderTitle
            heading={{ as: 'h1' }}
            action={<Button appearance="subtle" aria-label={HELP_TEXT.close} icon={<Dismiss24Regular />} onClick={() => setOpen(false)} />}
          >
            {(topic || guide) && !found && (
              <Button appearance="subtle" aria-label={HELP_TEXT.back} icon={<ArrowLeft20Regular />} onClick={back} />
            )}
            {guide ? '' : topic && !found ? topic.title : HELP_TEXT.open}
          </DrawerHeaderTitle>
          <Input
            contentBefore={<Search20Regular />}
            placeholder={HELP_TEXT.search}
            aria-label={HELP_TEXT.search}
            value={query}
            onChange={(_, data) => { setQuery(data.value); setGuide(null); }}
          />
        </DrawerHeader>
        <DrawerBody className={s.body}>{content()}</DrawerBody>
      </OverlayDrawer>
    </>
  );
}
