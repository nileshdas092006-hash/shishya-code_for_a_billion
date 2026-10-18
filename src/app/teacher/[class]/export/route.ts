import { getServices } from "@/server/instance";
import { teacherClass } from "../../../_lib/auth";

// GET /teacher/<class code>/export: the anonymous pilot CSV (counts only, no codes). Needs the class PIN cookie.

export async function GET(_request: Request, { params }: RouteContext<"/teacher/[class]/export">) {
  const classCode = decodeURIComponent((await params).class).toUpperCase();
  const cls = await teacherClass(classCode);
  if (!cls) return new Response("Enter the class PIN first.", { status: 403 });
  const csv = await (await getServices()).exportPilotCsv(cls.id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shishya-pilot-class-${cls.grade}${cls.section}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
