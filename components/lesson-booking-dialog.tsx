'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export function LessonBookingDialog({children,onClose,busy}:{children:ReactNode;onClose:()=>void;busy:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} aria-label="Complete your lesson booking" onCancel={event=>{event.preventDefault();if(!busy)onClose();}} className="m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg border border-[var(--club-border)] bg-[var(--club-surface)] p-5 text-[var(--club-text)] shadow-2xl backdrop:bg-black/50 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--club-border)] pb-3"><h2 className="text-lg font-extrabold">Complete your booking</h2><button type="button" onClick={onClose} disabled={busy} className="min-h-11 shrink-0 rounded-md border border-[var(--club-border)] px-4 text-sm font-bold disabled:opacity-50">Close</button></div>{children}</dialog>;
}
