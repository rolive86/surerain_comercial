import { redirect } from "next/navigation";

/** Legacy path — módulo renombrado a Rendición. */
export default function FacturasRedirectPage() {
  redirect("/gestion/rendicion");
}
