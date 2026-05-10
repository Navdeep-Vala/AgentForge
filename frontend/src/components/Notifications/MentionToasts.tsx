export interface MentionToast {
  id: string;
  title: string;
  body: string;
}

export interface ClarificationToast extends MentionToast {
  // Same structure, separate type for clarity
}

export interface ApprovalToast extends MentionToast {
  // Same structure, separate type for clarity
}

export function MentionToasts({
  toasts,
  clarificationToasts = [],
  approvalToasts = [],
  onDismiss,
}: {
  toasts: MentionToast[];
  clarificationToasts?: ClarificationToast[];
  approvalToasts?: ApprovalToast[];
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
      {clarificationToasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[26px] border border-[#dbeafe] bg-[#f0f9ff] px-5 py-4 shadow-[0_16px_40px_rgba(59,130,246,0.18)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-semibold text-[#1e40af]">{toast.title}</p>
              <p className="mt-1 text-[14px] leading-6 text-[#374151]">{toast.body}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="rounded-full bg-[#dbeafe] px-2 py-1 text-[12px] font-medium text-[#1e40af]"
            >
              Close
            </button>
          </div>
        </div>
      ))}
      {approvalToasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[26px] border border-[#2fba82] bg-[#f0fdf4] px-5 py-4 shadow-[0_16px_40px_rgba(47,186,130,0.18)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-semibold text-[#166534]">{toast.title}</p>
              <p className="mt-1 text-[14px] leading-6 text-[#374151]">{toast.body}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="rounded-full bg-[#2fba82]/10 px-2 py-1 text-[12px] font-medium text-[#166534]"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
