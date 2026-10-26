import { ApiStatus } from '@/components/api-status';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center px-6 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Emlak Platformu
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Gayrimenkul ilan altyapısı
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          Web uygulaması, API ve PostgreSQL aynı depoda çalışır. İlanlar,
          emlakçı profilleri ve bölge analizleri sonraki aşamalarda bu temelin
          üzerine eklenecek.
        </p>
        <ApiStatus />
      </div>
    </main>
  );
}
