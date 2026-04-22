import * as Tooltip from '@radix-ui/react-tooltip';

interface CellTooltipProps {
  content: string | null;
  children: React.ReactNode;
}

export function CellTooltip({ content, children }: CellTooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <Tooltip.Root delayDuration={400}>
      <Tooltip.Trigger asChild>
        <span>{children}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-[100] max-w-xs px-3 py-2 text-xs leading-relaxed text-slate-700 bg-white rounded-lg shadow-lg border border-slate-200 animate-in fade-in-0 zoom-in-95"
        >
          {content}
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
