"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  LogOut, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  LayoutDashboard,
  BarChart3,
  Bell,
} from "lucide-react";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isPublicStudentRoute = pathname === "/student" || pathname === "/student/test-login";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("gsb_student_sidebar_collapsed");
      if (stored === "1") setIsSidebarCollapsed(true);
      setMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("gsb_student_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("https://komunitasgsb.id/");
    } catch (error) {
      console.error("Logout failed", error);
      router.replace("https://komunitasgsb.id/");
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "Progress Belajar", href: "/student/progress", icon: BarChart3 },
  ];

  if (!mounted) return null;

  if (isPublicStudentRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-slate-900 flex">
      {/* ===== SIDEBAR ===== */}
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <div className={`
        fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-slate-200/60 
        flex flex-col z-50 transition-[transform,width] duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:shadow-none
        w-[280px] ${isSidebarCollapsed ? "lg:w-[84px]" : "lg:w-[280px]"}
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo Area */}
        <div className={`h-20 flex items-center border-b border-slate-100 justify-between ${isSidebarCollapsed ? "lg:px-4" : "px-6"}`}>
          <Link href="/student/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
              <Image
                src="/logo-gsb.png"
                alt="Logo GSB"
                width={30}
                height={36}
                className="h-8 w-7 object-contain"
                priority
              />
            </div>
            <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <span className="font-heading font-bold text-lg leading-tight text-gsb-maroon tracking-tight">Portal Siswa</span>
              <span className="text-[10px] font-bold text-gsb-orange uppercase tracking-widest">Gema Simpul Berdaya</span>
            </div>
          </Link>
          <button
            className="hidden lg:flex h-9 w-9 items-center justify-center text-slate-500 hover:text-gsb-maroon hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
            onClick={toggleSidebarCollapsed}
            aria-label={isSidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
            title={isSidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <button 
            className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-6 space-y-1.5 overflow-y-auto ${isSidebarCollapsed ? "lg:px-3 px-4" : "px-4"}`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/student/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                title={item.label}
                className={`
                  flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group font-medium
                  ${isSidebarCollapsed ? "lg:justify-center lg:px-0" : ""}
                  ${isActive 
                    ? "bg-gsb-orange text-white shadow-md shadow-gsb-orange/20" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-gsb-maroon border border-transparent hover:border-slate-200/50"
                  }
                `}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-gsb-maroon"}`} />
                <span className={`${isActive ? "font-bold" : "font-semibold"} ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Area */}
        <div className={`border-t border-slate-100 bg-slate-50/50 ${isSidebarCollapsed ? "lg:p-3 p-4" : "p-4"}`}>
          <div className={`bg-gradient-to-br from-gsb-orange/10 to-amber-500/5 border border-gsb-orange/20 rounded-xl p-4 mb-4 shadow-sm ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 bg-gsb-orange rounded-lg flex items-center justify-center shadow-md shadow-gsb-orange/20">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <p className="font-heading font-bold text-sm text-gsb-orange">Siap Belajar?</p>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">Lanjutkan belajarmu untuk mencapai kampus impian bersama GSB.</p>
          </div>
          
          <button
            onClick={handleLogout}
            title="Keluar Sistem"
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold group border border-transparent hover:border-red-100 ${isSidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <LogOut className="h-5 w-5 text-slate-400 group-hover:text-red-500" />
            <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Keluar Sistem</span>
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FDFBF7] relative">
        <div className="absolute inset-x-0 top-0 h-44 bg-white/65 border-b border-slate-200/60 pointer-events-none" />

        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 bg-white"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-heading font-bold text-gsb-maroon tracking-tight">Portal Siswa</span>
          </div>
          <button className="h-10 w-10 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-500 relative shadow-sm">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-gsb-orange rounded-full border-2 border-white"></span>
          </button>
        </header>

        {/* Main Header (Desktop) */}
        <header className="hidden lg:flex h-20 bg-transparent px-8 items-center justify-between z-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gsb-maroon">Student LMS</p>
            <p className="text-sm font-semibold text-slate-500 mt-1">Ruang belajar SNBT Gema Simpul Berdaya</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="h-11 w-11 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors relative shadow-sm hover:shadow">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-gsb-orange rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
