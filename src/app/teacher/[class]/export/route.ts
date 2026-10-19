import { getServices, isSetupError } from "@/server/instance";
import { logServerError } from "@/server/setup";
import { SETUP_MISSING_TEACHER, SOMETHING_WRONG_TEACHER } from "../../../_lib/page-guard";
import { teacherClass } from "../../../_lib/auth";

// GET /teacher/<class code>/export: the anonymous pilot CSV (counts only, no codes). Needs the class PIN cookie.

export async function GET(_request: Request, { params }: RouteContext<"/teacher/[class]/export">) {
  const classCode = decodeURIComponent((await params).class).toUpperCase();
  let csv: string;
  let cls: Awaited<ReturnType<typeof teacherClass>>;
  try {
    cls = await teacherClass(classCode);
    if (!cls) return new Response("Enter the class PIN first.", { status: 403 });
    csv = await (await getServices()).exportPilotCsv(cls.id);
  } catch (e) {
    logServerError("pilot CSV", e); // the real cause stays in the server log
    return new Response(isSetupError(e) ? SETUP_MISSING_TEACHER : SOMETHING_WRONG_TEACHER, { status: 503 });
  }
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shishya-pilot-class-${cls.grade}${cls.section}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
