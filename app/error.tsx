"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.message.includes("database") || error.message.includes("Prisma")
          ? "The wardrobe database could not be read. Make sure you ran `npm run setup` on the computer."
          : "An unexpected error happened. Details are printed in the terminal running the app."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
