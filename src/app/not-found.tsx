import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-sr py-24 text-center">
      <h1 className="font-display text-3xl font-bold text-sr-ink">
        Producto no encontrado
      </h1>
      <p className="mt-3 text-sr-ink/55">
        El producto no existe o no está publicado en el catálogo.
      </p>
      <Link href="/catalogo" className="btn-primary mt-8 inline-flex">
        Volver al catálogo
      </Link>
    </div>
  );
}
