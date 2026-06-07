import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signStudentSessionJWT } from "@/lib/jwt";
import Link from "next/link";
import { GraduationCap, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";

export default async function StudentTestLoginPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-14 w-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Tidak Tersedia</h1>
          <p className="text-sm text-slate-500">Halaman ini hanya untuk development</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-br from-gsb-orange to-gsb-orange-dark rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gsb-orange/20">
            <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Test Login Student</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Bypass SSO — untuk testing fitur Student LMS
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-5 sm:p-8">
          {/* Dev badge */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Mode development — progress tersimpan di database berdasarkan ID Siswa
            </p>
          </div>

          <form
            action={async (formData: FormData) => {
              "use server";
              const name = formData.get("name") as string || "Siswa Test";
              const userId = formData.get("userId") as string || `test-${Date.now()}`;

              // Pakai token sesi LMS yang sama dengan alur SSO asli (secret internal).
              const token = await signStudentSessionJWT({
                id: userId,
                name,
                role: "STUDENT",
              });

              const cookieStore = await cookies();
              cookieStore.set("gsb_student_token", token, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 60 * 60 * 24,
                path: "/",
              });

              redirect("/student/dashboard");
            }}
            className="space-y-4 sm:space-y-5"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-slate-700 mb-1.5">
                Nama Siswa
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue="Siswa Test SNBT"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-gsb-orange/30 focus:border-gsb-orange transition-all placeholder:text-slate-300"
                placeholder="Nama siswa"
              />
            </div>

            <div>
              <label htmlFor="userId" className="block text-sm font-bold text-slate-700 mb-1.5">
                ID Siswa
              </label>
              <input
                id="userId"
                name="userId"
                type="text"
                defaultValue={""}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-gsb-orange/30 focus:border-gsb-orange transition-all placeholder:text-slate-300"
                placeholder="Kosongkan untuk ID acak"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Progress tersimpan berdasarkan ID ini. Gunakan ID yang sama untuk melanjutkan progress.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-gsb-orange to-gsb-orange-dark text-white rounded-xl font-bold text-sm hover:from-gsb-orange/90 hover:to-gsb-orange-dark/90 shadow-lg shadow-gsb-orange/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <ShieldCheck className="h-4 w-4" />
              Masuk sebagai Siswa
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Halaman ini bypass SSO dari gsb-web.
              <br />Gunakan untuk testing fitur Student LMS saja.
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs text-slate-500 font-medium hover:text-gsb-maroon transition-colors">
            Login Admin / Relawan
          </Link>
        </div>
      </div>
    </div>
  );
}
