/**
 * Shiora on Aethelred — Research Portal Page
 *
 * Browse IRB-compliant research studies, contribute anonymized
 * health data, and earn AETHEL compensation for participation.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Microscope, FlaskConical, Shield, ShieldCheck,
  Lock, Users, BookOpen, FileText, Coins,
  Search, Loader2, AlertTriangle, CheckCircle,
  Brain, Database, Eye, KeyRound,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader, StatusBadge, HealthMetricCard } from '@/components/ui/PagePrimitives';
import { useResearch } from '@/hooks/useResearch';
import { StudyCard, ContributionHistory, EnrollModal } from '@/components/research/ResearchComponents';

import type { ResearchStudy, RecordType, StudyStatus } from '@/types';

// ============================================================
// Main Page
// ============================================================

const SEED = 1910;

export default function ResearchPage() {
  const { addNotification } = useApp();

  const {
    studies,
    contributions,
    isLoading,
    isLoadingContributions,
    error,
    enrollMutation,
    contributeMutation,
    activeStudyCount,
  } = useResearch();

  const [activeTab, setActiveTab] = useState('studies');
  const [statusFilter, setStatusFilter] = useState<StudyStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollTarget, setEnrollTarget] = useState<ResearchStudy | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const tabs = [
    { id: 'studies', label: 'Available Studies', count: studies.length },
    { id: 'contributions', label: 'My Contributions', count: contributions.length },
    { id: 'about', label: 'About Research' },
  ];

  const statusTabs = [
    { id: 'all', label: 'All' },
    { id: 'recruiting', label: 'Recruiting', count: studies.filter((s) => s.status === 'recruiting').length },
    { id: 'active', label: 'Active', count: studies.filter((s) => s.status === 'active').length },
    { id: 'completed', label: 'Completed' },
    { id: 'suspended', label: 'Suspended' },
  ];

  const filteredStudies = useMemo(() => {
    let result = studies;
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.institution.toLowerCase().includes(q) ||
        s.principalInvestigator.toLowerCase().includes(q)
      );
    }
    return result;
  }, [studies, statusFilter, searchQuery]);

  const totalCompensation = contributions
    .filter((c) => c.status === 'accepted')
    .reduce((sum, c) => sum + c.compensation, 0);

  const handleEnroll = (id: string) => {
    const study = studies.find((s) => s.id === id);
    if (study) {
      setEnrollTarget(study);
      setEnrollOpen(true);
    }
  };

  const handleConfirmEnroll = (studyId: string, dataTypes: RecordType[]) => {
    enrollMutation.mutate(studyId);
    contributeMutation.mutate({ studyId, dataTypes });
    setEnrollOpen(false);
    setEnrollTarget(null);
    addNotification(
      'success',
      'Enrolled Successfully',
      'You have been enrolled in the study. Your data contribution is pending review.',
    );
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ---- Header ---- */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Microscope className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold text-slate-900">Research Portal</h1>
              </div>
              <p className="text-sm text-slate-500">
                Contribute your anonymized health data to IRB-approved research studies and earn AETHEL compensation
              </p>
            </div>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active Studies</p>
                  <p className="text-xl font-bold text-slate-900">{activeStudyCount}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">My Contributions</p>
                  <p className="text-xl font-bold text-slate-900">{contributions.length}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Earned</p>
                  <p className="text-xl font-bold text-slate-900">{totalCompensation} AETHEL</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">IRB Approved</p>
                  <p className="text-xl font-bold text-slate-900">{studies.length}</p>
                </div>
              </div>
            </MedicalCard>
          </div>

          {/* ---- Tabs ---- */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

          {/* ---- Available Studies Tab ---- */}
          {activeTab === 'studies' && (
            <>
              {/* Filters */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <Tabs
                  tabs={statusTabs}
                  activeTab={statusFilter}
                  onChange={(id) => setStatusFilter(id as StudyStatus | 'all')}
                />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search studies..."
                    className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent w-56"
                  />
                </div>
              </div>

              {/* Study cards */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                  <p className="text-sm text-red-500">Failed to load studies</p>
                </div>
              ) : filteredStudies.length === 0 ? (
                <div className="py-12 text-center">
                  <Microscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No studies match your filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudies.map((study) => (
                    <StudyCard
                      key={study.id}
                      study={study}
                      onEnroll={handleEnroll}
                      isEnrolling={enrollMutation.isLoading}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---- My Contributions Tab ---- */}
          {activeTab === 'contributions' && (
            <>
              {isLoadingContributions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : (
                <ContributionHistory contributions={contributions} studies={studies} />
              )}
            </>
          )}

          {/* ---- About Research Tab ---- */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <MedicalCard>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-brand-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">How Research Works on Shiora</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Shiora enables privacy-preserving health research by allowing you to contribute anonymized data
                  to IRB-approved studies. All data processing happens inside Trusted Execution Environment (TEE)
                  enclaves, ensuring your individual records are never exposed to researchers.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <Lock className="w-5 h-5 text-brand-500 mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">Privacy First</h4>
                    <p className="text-xs text-slate-500">
                      Your data never leaves TEE enclaves. Researchers only receive aggregate, anonymized results
                      verified by blockchain attestations.
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">IRB Compliance</h4>
                    <p className="text-xs text-slate-500">
                      Every study on Shiora has been reviewed and approved by an Institutional Review Board (IRB)
                      to ensure ethical research practices.
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <Coins className="w-5 h-5 text-amber-500 mb-2" />
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">Fair Compensation</h4>
                    <p className="text-xs text-slate-500">
                      Earn AETHEL tokens for your data contributions. Compensation is paid directly to your wallet
                      upon acceptance of your contribution.
                    </p>
                  </div>
                </div>
              </MedicalCard>

              <MedicalCard>
                <h3 className="text-base font-semibold text-slate-900 mb-4">Privacy Guarantees</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Zero-Knowledge Proofs</h4>
                      <p className="text-xs text-slate-500">
                        ZKP verification ensures your data meets study requirements without revealing your identity
                        or individual health records.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">TEE Processing</h4>
                      <p className="text-xs text-slate-500">
                        All data aggregation and analysis happens inside hardware-secured Trusted Execution Environments.
                        Data is encrypted at rest and in transit.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Revocable Consent</h4>
                      <p className="text-xs text-slate-500">
                        You can withdraw your participation and revoke data access at any time. Smart contracts enforce
                        your consent preferences on-chain.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Differential Privacy</h4>
                      <p className="text-xs text-slate-500">
                        Statistical noise is added to query results to prevent re-identification of individual participants.
                        Results are mathematically guaranteed to be privacy-preserving.
                      </p>
                    </div>
                  </div>
                </div>
              </MedicalCard>

              <MedicalCard>
                <h3 className="text-base font-semibold text-slate-900 mb-4">Data Usage</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">What data is used?</h4>
                      <p className="text-xs text-slate-500">
                        Only the specific data types you select for each study are contributed. You choose exactly
                        which health records to share, and each contribution requires explicit consent.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Eye className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Who sees my data?</h4>
                      <p className="text-xs text-slate-500">
                        No one sees your individual data. Researchers only access aggregate statistics computed inside
                        TEE enclaves. Every access is logged on-chain for full audit transparency.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Brain className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">How does it advance science?</h4>
                      <p className="text-xs text-slate-500">
                        Your contributions enable groundbreaking research into reproductive health, fertility,
                        and personalized medicine -- all while maintaining the highest standards of data privacy
                        through the Aethelred blockchain.
                      </p>
                    </div>
                  </div>
                </div>
              </MedicalCard>
            </div>
          )}

          {/* ---- Security Notice ---- */}
          <div className="mt-8 p-5 bg-brand-50 border border-brand-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-brand-900 mb-1">Privacy-Preserving Research</h4>
                <p className="text-sm text-brand-700">
                  All research data is processed inside TEE enclaves on the Aethelred blockchain.
                  Your individual records are never exposed to researchers. Only aggregate, anonymized
                  results leave the enclave, with each step producing a verifiable attestation on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Enroll modal */}
      <EnrollModal
        study={enrollTarget}
        open={enrollOpen}
        onClose={() => { setEnrollOpen(false); setEnrollTarget(null); }}
        onConfirm={handleConfirmEnroll}
        isLoading={enrollMutation.isLoading}
      />
    </>
  );
}
