/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogIn, 
  LogOut, 
  Plus, 
  Database, 
  Activity, 
  AlertCircle, 
  Clock, 
  Filter,
  Search,
  Terminal,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Menu,
  X,
  CheckCircle,
  Trash2,
  Edit,
  XCircle,
  Check,
  Lock,
  User,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Users
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  OperationType,
  handleFirestoreError,
  getFriendlyErrorMessage,
  testConnection
} from './lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  addDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

// Types
interface OperatorProfile {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  status: 'active' | 'inactive';
}

interface WorkerRecord {
  id: string;
  operatorId: string;
  operatorName: string;
  nama: string;
  asalKota: string;
  penempatan: string;
  statusPekerja: 'AKTIF' | 'TIDAK';
  bekerjaSelama: string;
  statusKependudukan: 'MENIKAH' | 'LAJANG' | 'CERAI SAH' | 'CERAI PISAH RANJANG';
  catatan?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: any;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVAL_CHANGE';
  entityId: string;
  entityName?: string;
  details?: string;
  timestamp: any;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [isSecondaryAuthPassed, setIsSecondaryAuthPassed] = useState(false);
  const [secondaryAuthLoading, setSecondaryAuthLoading] = useState(true);
  const [secondaryAuthError, setSecondaryAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WorkerRecord[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [showResetFiltersConfirm, setShowResetFiltersConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<WorkerRecord | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [rowLogs, setRowLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [formStatus, setFormStatus] = useState<'AKTIF' | 'TIDAK'>('AKTIF');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    asalKota: '',
    penempatan: '',
    statusPekerja: '',
    approvalStatus: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'nama' | 'asalKota' | 'timestamp';
    direction: 'asc' | 'desc';
  }>({ key: 'timestamp', direction: 'desc' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testConnection();
    const storedAuth = sessionStorage.getItem('secondaryAuthPassed');
    if (storedAuth === 'true') {
      setIsSecondaryAuthPassed(true);
    }
    setSecondaryAuthLoading(false);

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        setLoading(true); 
        await fetchProfile(authUser.uid, authUser);
      } else {
        setProfile(null);
        setEntries([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile) {
      let q = query(collection(db, 'entries'), orderBy('timestamp', 'desc'));
      
      // Apply filters if they exist
      const { asalKota, penempatan, statusPekerja, approvalStatus } = filters;
      
      // Note: Firestore handles multiple equality filters smoothly
      // For case-sensitive partial matching, we would need different strategies, 
      // but for exact matches or client-side filtering it works.
      // We'll use client-side filtering for Asal Kota and Penempatan to allow for more flexible searching (case-insensitive)
      // while using Firestore for Status Pekerja.
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let entryData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkerRecord[];

        // Global Search filtering
        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          entryData = entryData.filter(e => 
            e.nama.toLowerCase().includes(lowerQuery) ||
            e.asalKota.toLowerCase().includes(lowerQuery) ||
            e.penempatan.toLowerCase().includes(lowerQuery)
          );
        }

        // Client-side refinement for better UX (case insensitive partial match)
        if (asalKota) {
          entryData = entryData.filter(e => e.asalKota.toLowerCase().includes(asalKota.toLowerCase()));
        }
        if (penempatan) {
          entryData = entryData.filter(e => e.penempatan.toLowerCase().includes(penempatan.toLowerCase()));
        }
        if (statusPekerja) {
          entryData = entryData.filter(e => e.statusPekerja === statusPekerja);
        }
        if (approvalStatus) {
          entryData = entryData.filter(e => e.approvalStatus === approvalStatus);
        }

        // Sorting logic
        entryData.sort((a, b) => {
          let valA: any = a[sortConfig.key];
          let valB: any = b[sortConfig.key];

          if (sortConfig.key === 'timestamp') {
            valA = a.timestamp?.toDate().getTime() || 0;
            valB = b.timestamp?.toDate().getTime() || 0;
          } else {
            valA = (valA as string).toLowerCase();
            valB = (valB as string).toLowerCase();
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });

        setEntries(entryData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'entries');
      });
      return () => unsubscribe();
    }
  }, [profile, filters, sortConfig, searchQuery]);

  const fetchProfile = async (uid: string, authUser?: any) => {
    try {
      const docRef = doc(db, 'operators', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as OperatorProfile);
      } else if (authUser) {
        // Create automatic profile if not exists
        const newProfile: OperatorProfile = {
          userId: authUser.uid,
          name: authUser.displayName || 'Operator',
          email: authUser.email || '',
          role: 'operator',
          status: 'active'
        };
        await setDoc(docRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setProfile(newProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `operators/${uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // fetchProfile is handled by onAuthStateChanged
    } catch (err) {
      setError("Gagal login: " + (err as Error).message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsSecondaryAuthPassed(false);
    sessionStorage.removeItem('secondaryAuthPassed');
  };

  const handleSort = (key: 'nama' | 'asalKota' | 'timestamp') => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const logAction = async (action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVAL_CHANGE', entityId: string, entityName?: string, details?: string) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'audit-logs'), {
        userId: profile.userId,
        userName: profile.name,
        action,
        entityId,
        entityName: entityName || '',
        details: details || '',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to create audit log:", err);
    }
  };

  const fetchLogs = (entityId: string) => {
    setLogsLoading(true);
    const q = query(collection(db, 'audit-logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AuditLog))
        .filter(log => log.entityId === entityId);
      setRowLogs(logs);
      setLogsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'audit-logs');
      setLogsLoading(false);
    });
    return unsubscribe;
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    const record = entries.find(e => e.id === recordToDelete);
    try {
      await deleteDoc(doc(db, 'entries', recordToDelete));
      if (record) {
        await logAction('DELETE', recordToDelete, record.nama, `Record dihapus oleh ${profile?.name}`);
      }
      setRecordToDelete(null);
      setSuccessMessage("Record berhasil dihapus!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `entries/${recordToDelete}`);
    }
  };

  const updateApprovalStatus = async (entryId: string, status: 'APPROVED' | 'REJECTED') => {
    const record = entries.find(e => e.id === entryId);
    try {
      await updateDoc(doc(db, 'entries', entryId), {
        approvalStatus: status
      });
      await logAction('APPROVAL_CHANGE', entryId, record?.nama, `Status berubah dari ${record?.approvalStatus} menjadi ${status}`);
      setSuccessMessage(`Record ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `entries/${entryId}`);
    }
  };

  const exportToCSV = () => {
    if (entries.length === 0) return;
    
    const headers = ["Nama", "Asal Kota", "Penempatan", "Status Pekerja", "Masa Kerja", "Approval", "Status Kependudukan", "Operator", "Tanggal", "Catatan"];
    
    const rows = entries.map(e => [
      `"${e.nama.replace(/"/g, '""')}"`,
      `"${e.asalKota.replace(/"/g, '""')}"`,
      `"${e.penempatan.replace(/"/g, '""')}"`,
      e.statusPekerja,
      `"${e.bekerjaSelama.replace(/"/g, '""')}"`,
      e.approvalStatus,
      e.statusKependudukan,
      `"${e.operatorName.replace(/"/g, '""')}"`,
      e.timestamp ? new Date(e.timestamp.toDate()).toLocaleString('id-ID') : '',
      `"${(e.catatan || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIndicator = ({ column }: { column: 'nama' | 'asalKota' | 'timestamp' }) => {
    if (sortConfig.key !== column) return <div className="w-4" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-black" /> : <ChevronDown size={14} className="text-black" />;
  };

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    const formData = new FormData(e.currentTarget);
    const nama = formData.get('nama') as string;
    const asalKota = formData.get('asalKota') as string;
    const penempatan = formData.get('penempatan') as string;
    const statusPekerja = formData.get('statusPekerja') as any;
    const bekerjaSelama = formData.get('bekerjaSelama') as string;
    const statusKependudukan = formData.get('statusKependudukan') as any;
    const catatan = formData.get('catatan') as string;

    const entryData = {
      nama: nama || '-',
      asalKota: asalKota || '-',
      penempatan: penempatan || '-',
      statusPekerja,
      bekerjaSelama: bekerjaSelama || '-',
      statusKependudukan,
      catatan: catatan || '-',
    };

    try {
      if (recordToEdit) {
        await updateDoc(doc(db, 'entries', recordToEdit.id), {
          ...entryData,
          // approvalStatus is not changed here by standard editors (rules enforce this)
        });
        await logAction('UPDATE', recordToEdit.id, entryData.nama, 'Informasi record diperbarui');
        setSuccessMessage("Record berhasil diperbarui!");
      } else {
        const docRef = await addDoc(collection(db, 'entries'), {
          ...entryData,
          operatorId: profile.userId,
          operatorName: profile.name,
          approvalStatus: 'PENDING',
          timestamp: serverTimestamp()
        });
        await logAction('CREATE', docRef.id, entryData.nama, 'Record baru dibuat');
        setSuccessMessage("Record berhasil disimpan!");
      }
      
      setShowEntryForm(false);
      setRecordToEdit(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    }
  };

  const handleSecondaryLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pengguna = formData.get('pengguna') as string;
    const sandi = formData.get('sandi') as string;

    if (pengguna === 'ADMINLIPUNG' && sandi === 'LIPUNGADMIN') {
      setIsSecondaryAuthPassed(true);
      sessionStorage.setItem('secondaryAuthPassed', 'true');
      setSecondaryAuthError(null);
    } else {
      setSecondaryAuthError('Kredensial tidak valid (Pengguna/Kata Sandi Salah)');
    }
  };

  useEffect(() => {
    if (expandedRowId) {
      const unsubscribe = fetchLogs(expandedRowId);
      return () => unsubscribe();
    } else {
      setRowLogs([]);
    }
  }, [expandedRowId]);

  if (loading || secondaryAuthLoading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center">
        <Activity className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black tracking-tighter mb-2 text-black leading-none">WARCET</h1>
          <p className="text-gray-500 uppercase tracking-widest text-[10px] font-bold">Database Operator System</p>
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
          <div className="flex justify-center mb-6">
            <Terminal className="text-black" size={48} />
          </div>
          <h2 className="text-2xl font-bold text-center mb-8">Operator Terminal</h2>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-black text-white py-4 px-6 rounded-2xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-black/20"
          >
            <LogIn size={20} />
            Masuk dengan Google
          </button>
          <div className="mt-8 pt-8 border-t border-gray-50 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-tight">Sistem Terenkripsi & Terintegrasi</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isSecondaryAuthPassed) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black tracking-tighter mb-2 text-black leading-none">GATEWAY</h1>
          <p className="text-gray-500 uppercase tracking-widest text-[10px] font-bold">Autentikasi Internal Diperlukan</p>
        </div>
        
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 z-0" />
          
          <div className="relative z-10">
            <div className="flex justify-center mb-8 text-black">
              <Lock size={56} strokeWidth={2.5} />
            </div>
            
            <h2 className="text-2xl font-black text-center mb-2 tracking-tight">Akses Terbatas</h2>
            <p className="text-gray-400 text-center text-sm mb-10 font-medium px-4">
              Silahkan masukkan kredensial operator internal untuk melanjutkan.
            </p>

            <form onSubmit={handleSecondaryLogin} className="space-y-4">
              <div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    name="pengguna"
                    required
                    placeholder="Nama Pengguna"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    name="sandi"
                    type="password"
                    required
                    placeholder="Kata Sandi"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                  />
                </div>
              </div>

              {secondaryAuthError && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {secondaryAuthError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-black text-white py-5 rounded-2xl font-black text-sm shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98] mt-4"
              >
                VERIFIKASI AKSES
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-50 flex flex-col items-center gap-4">
              <button 
                onClick={handleLogout}
                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
              >
                Kembali ke Login Google
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                <CheckCircle size={12} className="text-emerald-500" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Identitas Google Terverifikasi</span>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-12 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Operational Security Level 4</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-black">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-white border-b border-gray-100 z-[110] flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-12 flex-1">
          <div className="flex flex-col flex-shrink-0">
            <span className="text-3xl font-black tracking-tighter leading-none">WARCET</span>
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Database</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-8 flex-shrink-0">
            <a href="#" className="text-sm font-bold text-black border-b-2 border-black pb-1">Dashboard</a>
            <a href="#" className="text-sm font-medium text-gray-400 hover:text-black transition-colors">Arsip</a>
            <a href="#" className="text-sm font-medium text-gray-400 hover:text-black transition-colors">Statistik</a>
          </div>

          {/* Global Search Bar */}
          <div className="hidden md:flex flex-1 max-w-sm ml-4 border-l border-gray-100 pl-8">
            <div className="relative w-full">
              <Plus size={20} className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 rotate-45" />
              <input 
                type="text"
                placeholder="Cari nama, kota, atau instansi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none focus:outline-none text-sm font-medium placeholder:text-gray-300"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-bold text-black">{profile?.name}</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-500" />
              {profile?.role}
            </span>
          </div>
          
          <button 
            className="md:p-3 p-2 bg-gray-50 hover:bg-gray-100 text-black rounded-xl lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="hidden md:flex p-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Confirm Logout Modal */}
      {/* Statistics Modal */}
      <AnimatePresence>
        {showStatsModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-12 text-black">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStatsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-white w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col"
            >
              <div className="p-8 md:p-10 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-3xl font-black tracking-tight mb-1">Analisis Data</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Statistik Operasional Terkini</p>
                </div>
                <button 
                  onClick={() => setShowStatsModal(false)}
                  className="p-4 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 pb-12">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-8 bg-black text-white rounded-[2rem] shadow-xl relative overflow-hidden group">
                    <Users className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Record</p>
                    <p className="text-5xl font-black">{entries.length}</p>
                    <p className="text-xs font-medium text-gray-500 mt-2">Data tersinkronisasi</p>
                  </div>
                  
                  <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2rem] relative overflow-hidden group">
                    <CheckCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/5 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Disetujui</p>
                    <p className="text-5xl font-black text-emerald-600">{entries.filter(e => e.approvalStatus === 'APPROVED').length}</p>
                    <p className="text-xs font-medium text-emerald-600/60 mt-2">Verified records</p>
                  </div>

                  <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2rem] relative overflow-hidden group">
                    <Clock className="absolute -right-4 -bottom-4 w-24 h-24 text-amber-500/5 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Tertunda (Pending)</p>
                    <p className="text-5xl font-black text-amber-600">{entries.filter(e => e.approvalStatus === 'PENDING').length}</p>
                    <p className="text-xs font-medium text-amber-600/60 mt-2">Menunggu verifikasi</p>
                  </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Approval Status Pie Chart */}
                  <div className="p-8 border border-gray-100 rounded-[2.5rem] bg-gray-50/30">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-black">
                        <PieChartIcon size={20} />
                      </div>
                      <h3 className="font-black text-lg">Distribusi Kelayakan</h3>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Approved', value: entries.filter(e => e.approvalStatus === 'APPROVED').length },
                              { name: 'Pending', value: entries.filter(e => e.approvalStatus === 'PENDING').length },
                              { name: 'Rejected', value: entries.filter(e => e.approvalStatus === 'REJECTED').length },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f59e0b" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Worker Status Bar Chart */}
                  <div className="p-8 border border-gray-100 rounded-[2.5rem] bg-gray-50/30">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-black">
                        <BarChart3 size={20} />
                      </div>
                      <h3 className="font-black text-lg">Status Keaktifan</h3>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Aktif', count: entries.filter(e => e.statusPekerja === 'AKTIF').length },
                            { name: 'Non-Aktif', count: entries.filter(e => e.statusPekerja === 'TIDAK').length },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9CA3AF' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9CA3AF' }} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                            {
                              [0, 1].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#000000' : '#D1D5DB'} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Top Placements Table */}
                <div className="p-8 border border-gray-100 rounded-[2.5rem] bg-gray-50/30">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-black">
                        <TrendingUp size={20} />
                      </div>
                      <h3 className="font-black text-lg">Top Penempatan</h3>
                    </div>
                  </div>
                  <div className="bg-white rounded-[2rem] border border-gray-50 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400">#</th>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400">INSTANSI / LOKASI</th>
                          <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400">TOTAL RECORD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.entries(
                          entries.reduce((acc: any, curr) => {
                            acc[curr.penempatan] = (acc[curr.penempatan] || 0) + 1;
                            return acc;
                          }, {})
                        )
                          .sort(([, a]: any, [, b]: any) => b - a)
                          .slice(0, 5)
                          .map(([location, count], idx) => (
                            <tr key={location} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-8 py-5 text-gray-400 font-black">{idx + 1}</td>
                              <td className="px-8 py-5 font-bold">{location}</td>
                              <td className="px-8 py-5 text-right font-black">
                                <span className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-lg text-xs">
                                  {count as any}
                                </span>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 text-black">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <LogOut size={32} />
              </div>
              <h2 className="text-xl font-black mb-2">Keluar Sesi?</h2>
              <p className="text-sm text-gray-400 mb-8">Anda akan keluar dari sistem. Pastikan semua data telah tersimpan.</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-4 text-xs font-bold text-gray-400 hover:text-black transition-colors"
                >
                  BATAL
                </button>
                <button 
                  onClick={() => {
                    handleLogout();
                    setShowLogoutConfirm(false);
                  }}
                  className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-xs shadow-xl hover:bg-gray-800 transition-all"
                >
                  YA, KELUAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[105] pt-28 px-8 lg:hidden flex flex-col"
          >
            <div className="flex flex-col gap-6 mb-12">
              <div className="pb-6 border-b border-gray-50 md:hidden">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Profil Operator</p>
                <p className="text-xl font-black text-black">{profile?.name}</p>
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1 uppercase">
                  <ShieldCheck size={12} />
                  {profile?.role}
                </p>
              </div>

              {/* Mobile Search */}
              <div className="md:hidden">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Pencarian Cepat</p>
                <div className="relative">
                  <Plus size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-45" />
                  <input 
                    type="text"
                    placeholder="Cari..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                  />
                </div>
              </div>

              <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black text-black">Dashboard</a>
              <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black text-gray-300">Arsip</a>
              <button 
                onClick={() => {
                  setShowStatsModal(true);
                  setIsMobileMenuOpen(false);
                }} 
                className="text-left text-2xl font-black text-black"
              >
                Statistik
              </button>
            </div>

            <div className="mt-auto pb-12 space-y-4">
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-500 py-5 rounded-2xl font-black text-sm"
              >
                Keluar System
                <LogOut size={20} />
              </button>
              <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">WARCET v1.0.4</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold"
          >
            <CheckCircle size={20} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-28 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Sistem Operasional Aktif</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-black mb-6">Ringkasan Aktivitas</h1>
            
            {/* Search Bar Integration */}
            <div className="relative max-w-xl">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Cari nama, kota, atau penempatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-100 py-4 pl-12 pr-12 rounded-3xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all text-black placeholder:text-gray-300"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-black transition-colors"
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative group">
              <button className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-all text-black">
                <Clock size={18} />
                Urutkan
              </button>
              <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] p-2">
                {[
                  { label: 'Nama (A-Z)', key: 'nama', dir: 'asc' },
                  { label: 'Nama (Z-A)', key: 'nama', dir: 'desc' },
                  { label: 'Asal Kota (A-Z)', key: 'asalKota', dir: 'asc' },
                  { label: 'Asal Kota (Z-A)', key: 'asalKota', dir: 'desc' },
                  { label: 'Terbaru', key: 'timestamp', dir: 'desc' },
                  { label: 'Terlama', key: 'timestamp', dir: 'asc' },
                ].map((opt) => (
                  <button
                    key={`${opt.key}-${opt.dir}`}
                    onClick={() => setSortConfig({ key: opt.key as any, direction: opt.dir as any })}
                    className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-colors
                      ${sortConfig.key === opt.key && sortConfig.direction === opt.dir 
                        ? 'bg-black text-white' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-black'}
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => setShowFilterModal(true)}
              className={`flex items-center gap-2 px-6 py-3 border rounded-2xl font-bold text-sm shadow-sm transition-all
                ${Object.values(filters).some(f => f !== '') 
                  ? 'bg-black text-white border-black' 
                  : 'bg-white border-gray-200 text-black hover:bg-gray-50'}
              `}
            >
              <Filter size={18} />
              {Object.values(filters).some(f => f !== '') ? 'Filter Aktif' : 'Filter'}
            </button>
            <button 
              onClick={exportToCSV}
              disabled={entries.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-black rounded-2xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button 
              onClick={() => setShowEntryForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all"
            >
              <Plus size={18} />
              Input Data Baru
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Input', value: entries.length, sub: 'Record', color: 'text-black' },
            { label: 'Menunggu', value: entries.filter(e => e.approvalStatus === 'PENDING').length, sub: 'Pending', color: 'text-amber-500' },
            { label: 'Disetujui', value: entries.filter(e => e.approvalStatus === 'APPROVED').length, sub: 'Approved', color: 'text-emerald-500' },
            { label: 'Ditolak', value: entries.filter(e => e.approvalStatus === 'REJECTED').length, sub: 'Rejected', color: 'text-red-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500 ease-out z-0" />
              <div className="relative z-10">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">{stat.label}</p>
                <div className="flex items-end gap-2 text-black">
                  <span className={`text-4xl font-black ${stat.color}`}>{stat.value}</span>
                  <span className="text-[10px] font-bold text-gray-400 mb-2 uppercase">{stat.sub}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto text-black">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th 
                    className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-black transition-colors"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center gap-1">
                      Waktu / Operator
                      <SortIndicator column="timestamp" />
                    </div>
                  </th>
                  <th 
                    className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-black transition-colors"
                    onClick={() => handleSort('nama')}
                  >
                    <div className="flex items-center gap-1">
                      Nama / Asal Kota
                      <SortIndicator column="nama" />
                    </div>
                  </th>
                  <th className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Penempatan</th>
                  <th className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Approval</th>
                  <th className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Info Kependudukan</th>
                  <th className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Catatan Tambahan</th>
                  <th className="p-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-24 text-center">
                      <div className="flex flex-col items-center gap-4 text-gray-300">
                        <Database size={64} strokeWidth={1} />
                        <p className="text-lg font-medium text-gray-400">Belum ada data yang tercatat.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      <tr 
                        onClick={() => setExpandedRowId(expandedRowId === entry.id ? null : entry.id)}
                        className={`border-b border-gray-50 transition-all group cursor-pointer
                          ${expandedRowId === entry.id ? 'bg-black text-white' : 'hover:bg-gray-50/50 text-black'}
                        `}
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                              ${expandedRowId === entry.id ? 'bg-white text-black' : 'bg-black text-white'}
                            `}>
                              {entry.operatorName.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold transition-colors ${expandedRowId === entry.id ? 'text-gray-400' : 'text-gray-400'}`}>
                                {entry.timestamp ? new Date(entry.timestamp.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '...'}
                              </span>
                              <span className={`text-sm font-extrabold transition-colors ${expandedRowId === entry.id ? 'text-white' : 'text-black'}`}>{entry.operatorName}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className={`text-base font-bold mb-1 transition-colors ${expandedRowId === entry.id ? 'text-white' : 'text-gray-800'}`}>{entry.nama}</span>
                            <span className={`text-sm line-clamp-1 transition-colors ${expandedRowId === entry.id ? 'text-gray-300' : 'text-gray-400'}`}>{entry.asalKota}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className={`text-sm font-medium transition-colors ${expandedRowId === entry.id ? 'text-white' : 'text-black'}`}>
                            {entry.penempatan}
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter
                            ${entry.statusPekerja === 'AKTIF' 
                              ? (expandedRowId === entry.id ? 'bg-white/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                              : (expandedRowId === entry.id ? 'bg-white/10 text-red-400' : 'bg-red-50 text-red-600')}
                          `}>
                            {entry.statusPekerja}
                          </span>
                          <div className={`text-[10px] mt-1 font-bold transition-colors ${expandedRowId === entry.id ? 'text-gray-400' : 'text-gray-400'}`}>
                            {entry.bekerjaSelama}
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter
                            ${entry.approvalStatus === 'APPROVED' ? (expandedRowId === entry.id ? 'bg-white/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : 
                              entry.approvalStatus === 'REJECTED' ? (expandedRowId === entry.id ? 'bg-white/10 text-red-400' : 'bg-red-50 text-red-600') : 
                              (expandedRowId === entry.id ? 'bg-white/10 text-amber-400' : 'bg-amber-50 text-amber-600')}
                          `}>
                            {entry.approvalStatus}
                          </span>
                          {profile && (
                            <div className="flex items-center justify-center gap-1 mt-2">
                              {entry.approvalStatus !== 'APPROVED' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateApprovalStatus(entry.id, 'APPROVED');
                                  }}
                                  className={`p-1.5 rounded-lg transition-all ${expandedRowId === entry.id ? 'bg-emerald-500 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                  title="Setujui"
                                >
                                  <Check size={12} />
                                </button>
                              )}
                              {entry.approvalStatus !== 'REJECTED' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateApprovalStatus(entry.id, 'REJECTED');
                                  }}
                                  className={`p-1.5 rounded-lg transition-all ${expandedRowId === entry.id ? 'bg-red-500 text-white' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                  title="Tolak"
                                >
                                  <XCircle size={12} />
                                </button>
                              )}
                              {entry.approvalStatus !== 'PENDING' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateApprovalStatus(entry.id, 'PENDING' as any);
                                  }}
                                  className="p-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all"
                                  title="Reset ke Pending"
                                >
                                  <Clock size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold uppercase tracking-tighter transition-colors ${expandedRowId === entry.id ? 'text-gray-300' : 'text-gray-500'}`}>Status: {entry.statusKependudukan}</span>
                            <div className={`text-[9px] mt-1 transition-colors ${expandedRowId === entry.id ? 'text-gray-500' : 'text-gray-300'}`}>ID: {entry.id.substring(0, 8)}</div>
                          </div>
                        </td>
                        <td className="p-6">
                          <p className={`text-sm line-clamp-1 max-w-[200px] transition-colors ${expandedRowId === entry.id ? 'text-gray-300' : 'text-gray-500'}`}>
                            {entry.catatan || '-'}
                          </p>
                        </td>
                        <td className="p-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {profile && (
                              <>
                                {entry.approvalStatus !== 'APPROVED' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateApprovalStatus(entry.id, 'APPROVED');
                                    }}
                                    className={`p-3 rounded-xl transition-all ${expandedRowId === entry.id ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                    title="Setujui Data"
                                  >
                                    <Check size={16} />
                                  </button>
                                )}
                                {entry.approvalStatus !== 'REJECTED' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateApprovalStatus(entry.id, 'REJECTED');
                                    }}
                                    className={`p-3 rounded-xl transition-all ${expandedRowId === entry.id ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                                    title="Tolak Data"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                )}
                              </>
                            )}
                            {(profile?.role === 'admin' || (entry.operatorId === user?.uid && entry.approvalStatus === 'PENDING')) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecordToEdit(entry);
                                  setFormStatus(entry.statusPekerja);
                                  setShowEntryForm(true);
                                }}
                                className={`p-3 rounded-xl transition-all ${expandedRowId === entry.id ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100'}`}
                                title="Edit Data"
                              >
                                <Edit size={16} />
                              </button>
                            )}
                            {(profile?.role === 'admin' || entry.operatorId === user?.uid) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecordToDelete(entry.id);
                                }}
                                className={`p-3 rounded-xl transition-all ${expandedRowId === entry.id ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100'}`}
                                title="Hapus Data"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Notes View */}
                      <AnimatePresence>
                        {expandedRowId === entry.id && (
                          <motion.tr 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-gray-900 border-b border-white/5"
                          >
                            <td colSpan={8} className="p-0 overflow-hidden">
                              <div className="p-8 flex flex-col md:flex-row gap-12">
                                <div className="flex-1">
                                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Catatan Lengkap</h4>
                                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5 mb-8">
                                    <p className="text-white font-medium leading-relaxed whitespace-pre-wrap">
                                      {entry.catatan || 'Tidak ada catatan tambahan untuk record ini.'}
                                    </p>
                                  </div>

                                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Riwayat Perubahan (Audit Log)</h4>
                                  <div className="space-y-3">
                                    {logsLoading ? (
                                      <div className="flex items-center gap-2 text-gray-500 text-xs py-4">
                                        <Activity size={12} className="animate-spin" />
                                        <span>Memuat riwayat...</span>
                                      </div>
                                    ) : rowLogs.length === 0 ? (
                                      <p className="text-gray-600 text-xs py-4 italic">Belum ada riwayat aktivitas tercatat.</p>
                                    ) : (
                                      rowLogs.map((log) => (
                                        <div key={log.id} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black
                                            ${log.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-400' : 
                                              log.action === 'APPROVAL_CHANGE' ? 'bg-amber-500/20 text-amber-400' : 
                                              'bg-blue-500/20 text-blue-400'}
                                          `}>
                                            {log.action.charAt(0)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4 mb-0.5">
                                              <span className="text-xs font-black text-white/90 truncate">{log.action === 'CREATE' ? 'Pembuatan Record' : log.action === 'UPDATE' ? 'Pembaruan Data' : 'Perubahan Status'}</span>
                                              <span className="text-[9px] font-bold text-gray-500 uppercase flex-shrink-0">
                                                {log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '...'}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-gray-400 leading-tight mb-1">{log.details}</p>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Oleh:</span>
                                              <span className="text-[9px] text-white/50 font-bold italic">{log.userName}</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                                <div className="w-full md:w-64 space-y-6">
                                  <div>
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Meta Info</h4>
                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Database ID</span>
                                        <span className="text-white font-mono">{entry.id}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Created By</span>
                                        <span className="text-white font-bold">{entry.operatorName}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Full Status</span>
                                        <span className="text-emerald-400 font-bold uppercase">{entry.statusPekerja}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => setExpandedRowId(null)}
                                    className="w-full py-4 text-xs font-black text-gray-500 hover:text-white transition-colors uppercase tracking-widest border border-white/5 rounded-2xl"
                                  >
                                    Tutup Detail
                                  </button>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-black">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRecordToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-black mb-2">Hapus Data?</h2>
              <p className="text-sm text-gray-400 mb-8">Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus record ini?</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setRecordToDelete(null)}
                  className="flex-1 py-4 text-xs font-bold text-gray-400 hover:text-black transition-colors"
                >
                  BATAL
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-xs shadow-xl hover:bg-red-600 transition-all shadow-red-200"
                >
                  YA, HAPUS
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Reset Filters Modal */}
      <AnimatePresence>
        {showResetFiltersConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-black">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetFiltersConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Filter size={32} />
              </div>
              <h2 className="text-xl font-black mb-2">Reset Filter?</h2>
              <p className="text-sm text-gray-400 mb-8">Semua filter yang telah Anda tentukan akan dihapus. Lanjutkan?</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowResetFiltersConfirm(false)}
                  className="flex-1 py-4 text-xs font-bold text-gray-400 hover:text-black transition-colors"
                >
                  BATAL
                </button>
                <button 
                  onClick={() => {
                    setFilters({ asalKota: '', penempatan: '', statusPekerja: '', approvalStatus: '' });
                    setShowResetFiltersConfirm(false);
                    setShowFilterModal(false);
                  }}
                  className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-xs shadow-xl hover:bg-gray-800 transition-all"
                >
                  YA, RESET
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilterModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 text-black">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black tracking-tight">Filter Data</h2>
                <button 
                  onClick={() => setShowFilterModal(false)}
                  className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <Plus size={24} className="rotate-45 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Asal Kota</label>
                  <input 
                    value={filters.asalKota}
                    onChange={(e) => setFilters(prev => ({ ...prev, asalKota: e.target.value }))}
                    placeholder="Semua Kota"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Penempatan</label>
                  <input 
                    value={filters.penempatan}
                    onChange={(e) => setFilters(prev => ({ ...prev, penempatan: e.target.value }))}
                    placeholder="Semua Penempatan"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Status Pekerja</label>
                  <div className="flex gap-2">
                    {['', 'AKTIF', 'TIDAK'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilters(prev => ({ ...prev, statusPekerja: status }))}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all
                          ${filters.statusPekerja === status 
                            ? 'bg-black text-white' 
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}
                        `}
                      >
                        {status === '' ? 'SEMUA' : status}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Status Approval</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'SEMUA', value: '' },
                      { label: 'PENDING', value: 'PENDING' },
                      { label: 'APPROVED', value: 'APPROVED' },
                      { label: 'REJECTED', value: 'REJECTED' }
                    ].map((status) => (
                      <button
                        key={status.value}
                        onClick={() => setFilters(prev => ({ ...prev, approvalStatus: status.value }))}
                        className={`flex-1 min-w-[80px] py-3 px-4 rounded-xl text-[10px] font-bold transition-all
                          ${filters.approvalStatus === status.value 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}
                        `}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50 flex gap-4">
                  <button 
                    onClick={() => setShowResetFiltersConfirm(true)}
                    className="flex-1 py-4 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
                  >
                    RESET FILTER
                  </button>
                  <button 
                    onClick={() => setShowFilterModal(false)}
                    className="flex-[2] bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-gray-800 transition-all"
                  >
                    TERAPKAN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entry Modal */}
      <AnimatePresence>
        {showEntryForm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 text-black">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEntryForm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-black">{recordToEdit ? 'Edit Data Database' : 'Input Data Database'}</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Operator: {recordToEdit?.operatorName || profile?.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowEntryForm(false);
                    setRecordToEdit(null);
                  }}
                  className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <Plus size={24} className="rotate-45 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddEntry} className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nama Lengkap</label>
                    <input 
                      name="nama"
                      required
                      defaultValue={recordToEdit?.nama || ''}
                      placeholder="Nama Lengkap / -"
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Asal Kota</label>
                    <input 
                      name="asalKota"
                      required
                      defaultValue={recordToEdit?.asalKota || ''}
                      placeholder="Asal Kota / -"
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Penempatan</label>
                  <input 
                    name="penempatan"
                    required
                    defaultValue={recordToEdit?.penempatan || ''}
                    placeholder="Instansi / Lokasi / -"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Status Pekerja</label>
                    <select 
                      name="statusPekerja" 
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none appearance-none font-bold text-black cursor-pointer"
                    >
                      <option value="AKTIF">AKTIF</option>
                      <option value="TIDAK">TIDAK AKTIF</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">
                      {formStatus === 'AKTIF' ? 'Bekerja Selama' : 'Lama Bekerja (Tahun/Bulan)'}
                    </label>
                    <input 
                      name="bekerjaSelama"
                      required
                      defaultValue={recordToEdit?.bekerjaSelama || ''}
                      placeholder={formStatus === 'AKTIF' ? "Contoh: 2 Tahun / -" : "Masa kerja sebelumnya"}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Status Kependudukan</label>
                  <select name="statusKependudukan" defaultValue={recordToEdit?.statusKependudukan || "LAJANG"} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none appearance-none font-bold text-black cursor-pointer">
                    <option value="LAJANG">LAJANG</option>
                    <option value="MENIKAH">MENIKAH</option>
                    <option value="CERAI SAH">CERAI SAH</option>
                    <option value="CERAI PISAH RANJANG">CERAI PISAH RANJANG</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Catatan Tambahan</label>
                  <textarea 
                    name="catatan"
                    rows={3}
                    defaultValue={recordToEdit?.catatan || ''}
                    placeholder="Masukkan catatan tambahan jika ada..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none text-black"
                  ></textarea>
                </div>

                <div className="pt-4 border-t border-gray-50">
                  <p className="text-[10px] text-gray-300 italic mb-4">* Jika tidak diketahui maka dijawab dengan tanda "-"</p>
                  <button 
                    type="submit"
                    className="w-full bg-black text-white py-5 px-6 rounded-2xl font-black text-lg shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98]"
                  >
                    {recordToEdit ? 'PERBARUI RECORD PEKERJA' : 'SIMPAN RECORD PEKERJA'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4"
          >
            <div className="bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-bold flex-1">{error}</p>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg">
                <Plus size={16} className="rotate-45" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
