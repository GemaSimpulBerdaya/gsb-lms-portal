import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Login Relawan | GSB LMS",
  description: "Masuk ke Dashboard Relawan Gema Simpul Berdaya",
};

export default function RelawanLoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gsb-sand/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {/* Placeholder for GSB Logo */}
          <div className="w-20 h-20 bg-gsb-green rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
            GSB
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gsb-green-dark">
          Portal Relawan
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Gema Simpul Berdaya
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 sm:rounded-xl sm:px-10">
          <form className="space-y-6" action="#" method="POST">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email Tim / Personal
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-gsb-green focus:border-gsb-green sm:text-sm"
                  placeholder="admin@tim-gsb.id"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Kata Sandi
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-gsb-green focus:border-gsb-green sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-gsb-green focus:ring-gsb-green border-slate-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-slate-900"
                >
                  Ingat saya
                </label>
              </div>

              <div className="text-sm">
                <a
                  href="#"
                  className="font-medium text-gsb-orange hover:text-gsb-orange-dark transition-colors"
                >
                  Lupa password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-gsb-green hover:bg-gsb-green-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gsb-green transition-all transform active:scale-[0.98]"
              >
                MASUK KE DASHBOARD
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  Bantuan
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                Belum punya akun tim?{" "}
                <Link
                  href="https://wa.me/your-number"
                  className="font-medium text-gsb-green hover:underline"
                >
                  Hubungi Admin GSB
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-gsb-green flex items-center justify-center gap-1"
          >
            ← Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
