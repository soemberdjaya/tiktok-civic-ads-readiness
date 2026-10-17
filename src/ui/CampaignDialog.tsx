import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import type { Campaign } from '../types';
import { t } from '../i18n';

export const DEFAULT_CAMPAIGN: Campaign = { objective: 'Traffic', minAge: 18, coreMessage: '', advertiser: '' };

export function CampaignDialog({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: Campaign;
  onSave: (c: Campaign) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[rgba(22,24,35,0.4)]" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 max-h-[90vh] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[4px] border border-line bg-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave(draft);
              onOpenChange(false);
            }}
          >
            <div className="border-b border-line px-6 py-4">
              <Dialog.Title className="m-0 text-lg font-bold">{t.campaign.title}</Dialog.Title>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold">{t.campaign.advertiser}</span>
                <input className="field" value={draft.advertiser} onChange={(e) => setDraft({ ...draft, advertiser: e.target.value })} />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold">{t.campaign.objective}</span>
                  <select className="field" value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })}>
                    {t.campaign.objectives.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold">{t.campaign.minAge}</span>
                  <select className="field" value={draft.minAge} onChange={(e) => setDraft({ ...draft, minAge: Number(e.target.value) })}>
                    {[13, 16, 18, 21, 25].map((a) => (
                      <option key={a} value={a}>
                        {a}+
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold">{t.campaign.core}</span>
                <textarea
                  className="field min-h-20"
                  placeholder={t.campaign.corePlaceholder}
                  value={draft.coreMessage}
                  onChange={(e) => setDraft({ ...draft, coreMessage: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-line bg-hover px-6 py-4">
              <Dialog.Close asChild>
                <button type="button" className="btn">
                  {t.campaign.close}
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary">
                {t.campaign.save}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
