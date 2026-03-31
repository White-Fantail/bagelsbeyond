const SOURCE_REF_PREVIEW_LENGTH = 12;

export { SOURCE_REF_PREVIEW_LENGTH };

interface SourceBadgeProps {
  channel: string | null;
  sourceRef: string | null;
}

export default function SourceBadge({ channel, sourceRef }: SourceBadgeProps) {
  if (!channel) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Local
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        {channel}
      </span>
      {sourceRef && (
        <span
          className="text-xs text-gray-400 font-mono truncate max-w-[120px]"
          title={sourceRef}
        >
          {sourceRef.slice(0, SOURCE_REF_PREVIEW_LENGTH)}…
        </span>
      )}
    </span>
  );
}
