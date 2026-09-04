export type MarginPreview = {
  count: number;
  examples: Array<{
    cod_articulo: string;
    descripcion: string | null;
    base: number;
    final: number;
  }>;
  note: string | null;
};
