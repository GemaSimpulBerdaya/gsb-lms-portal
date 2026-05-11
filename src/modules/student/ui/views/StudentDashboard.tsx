"use client";

import React from "react";
import { 
  BookOpen, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  PlayCircle, 
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";

interface Module {
  _id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  subCategory?: string;
  order: number;
  fileUrl?: string;
}

interface StudentDashboardProps {
  data: {
    studentName: string;
    totalModules: number;
    categories: Record<string, Module[]>;
  };
}

export default function StudentDashboard({ data }: StudentDashboardProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 hidden h-full w-64 bg-white border-r border-slate-200 lg:block z-20">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gsb-maroon rounded-xl flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 leading-none">GSB LMS</h1>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Portal SMA</p>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-slate-50 text-gsb-maroon rounded-xl font-bold transition-all">
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
              <BookOpen className="h-5 w-5" />
              <span>Modul SNBT</span>
            </a>
          </nav>
          
          <div className="p-4 border-t border-slate-100">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-medium">
              <LogOut className="h-5 w-5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-6 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Halo, {data.studentName}! 👋</h2>
            <p className="text-slate-500 text-sm mt-1">Siapkan dirimu untuk menaklukkan SNBT hari ini.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 pr-4 rounded-full border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-gsb-maroon/10 rounded-full flex items-center justify-center">
              <span className="font-bold text-gsb-maroon text-sm">{data.studentName.charAt(0)}</span>
            </div>
            <span className="text-sm font-bold text-slate-700">{data.studentName}</span>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="h-12 w-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Total Modul</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{data.totalModules}</p>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="h-12 w-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-4">
              <PlayCircle className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Dalam Progres</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">0</p>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="h-12 w-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Selesai</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">0</p>
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-12">
          {Object.entries(data.categories).map(([category, modules]) => (
            <section key={category}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-8 bg-gsb-maroon rounded-full"></div>
                  <h3 className="text-xl font-bold text-slate-800">{category}</h3>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{modules.length} Modul</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {modules.map((module, idx) => (
                  <div 
                    key={module._id}
                    className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-gsb-maroon/20 transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${idx === 0 ? 'bg-gsb-maroon/10 text-gsb-maroon' : 'bg-slate-100 text-slate-400'}`}>
                          {idx === 0 ? <PlayCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bagian {module.order}</span>
                      </div>
                      
                      <h4 className="font-bold text-slate-800 mb-2 group-hover:text-gsb-maroon transition-colors line-clamp-1">{module.title}</h4>
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-6">{module.description}</p>
                      
                      <button 
                        disabled={idx !== 0}
                        className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          idx === 0 
                          ? 'bg-gsb-maroon text-white hover:bg-gsb-maroon/90 shadow-lg shadow-gsb-maroon/20' 
                          : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {idx === 0 ? (
                          <>
                            <span>Mulai Belajar</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            <span>Terkunci</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
