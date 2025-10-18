import type { VoicemailBox } from "@/lib/types";

type Props = {
  voicemail: VoicemailBox[];
};

export const VoicemailPanel = ({ voicemail }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <header className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Voicemail
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mailbox usage summary across PBX contexts.
        </p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {voicemail.length} mailboxes
      </span>
    </header>

    <div className="grid gap-3 sm:grid-cols-2">
      {voicemail.length ? (
        voicemail.map((box) => (
          <article
            key={`${box.context}-${box.mailbox}`}
            className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm transition hover:border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {box.context}
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                {box.mailbox}
              </p>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-300">
                {box.newMessages} new / {box.oldMessages} old
              </span>
            </div>
          </article>
        ))
      ) : (
        <p className="col-span-full py-6 text-center text-sm italic text-slate-500 dark:text-slate-400">
          No voicemail data available.
        </p>
      )}
    </div>
  </section>
);
