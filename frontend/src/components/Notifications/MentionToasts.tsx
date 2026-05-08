export interface MentionToast {
  id: string;
  title: string;
  body: string;
}

export function MentionToasts({
  toasts,
  onDismiss,
}: {
  toasts: MentionToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-6 top-24 z-[60] flex w-[360px] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[26px] border border-[#eadfce] bg-[#fffdfa] px-5 py-4 shadow-[0_16px_40px_rgba(170,137,84,0.18)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-semibold text-[#231f1a]">{toast.title}</p>
              <p className="mt-1 text-[14px] leading-6 text-[#746c61]">{toast.body}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="rounded-full bg-[#f7f1e8] px-2 py-1 text-[12px] font-medium text-[#8f8679]"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
