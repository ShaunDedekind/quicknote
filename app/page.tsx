import NoteInput from '@/components/NoteInput';

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-xl">

        {/* Brand */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            QuickNote
          </h1>
          <p className="mt-1.5 text-sm text-stone-400">
            Say it or type it — we&apos;ll sort the rest.
          </p>
        </div>

        {/* Input experience */}
        <NoteInput />

      </div>
    </main>
  );
}
