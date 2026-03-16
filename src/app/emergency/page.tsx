/**
 * Shiora on Aethelred — Emergency & Care Coordination
 *
 * Emergency medical information, care team management, protocol
 * library, AI-powered triage, and care handoff tracking with
 * TEE-verified attestations.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Siren, Users, AlertOctagon, Activity, FileText,
  Heart, ShieldCheck, Pill, Clock,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import {
  TopNav, Footer, ToastContainer, SearchOverlay,
  Badge, Tabs, ProgressRing,
} from '@/components/ui/SharedComponents';
import {
  MedicalCard, HealthMetricCard, SectionHeader,
  ChartTooltip, StatusBadge, TEEBadge, TruncatedHash,
} from '@/components/ui/PagePrimitives';
import {
  EmergencyInfoCard,
  CareTeamMemberCard,
  ProtocolAccordion,
  TriageResult,
  HandoffCard,
  ESILevelBadge,
} from '@/components/emergency/EmergencyComponents';
import { useEmergency } from '@/hooks/useEmergency';
import { BRAND, CHART_COLORS, TRIAGE_LEVELS } from '@/lib/constants';
import {
  seededRandom, seededInt, seededHex, formatNumber,
  timeAgo, formatDate, formatDateTime, generateAttestation,
} from '@/lib/utils';

// ============================================================
// Constants
// ============================================================

const SEED = 2500;

const TAB_ITEMS = [
  { id: 'emergency-card', label: 'Emergency Card' },
  { id: 'care-team', label: 'Care Team' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'triage', label: 'Triage' },
  { id: 'handoffs', label: 'Handoffs' },
];

// Static default triage for display when no mutation result exists
const DEFAULT_TRIAGE = {
  id: 'triage-demo',
  symptoms: ['Chest tightness', 'Shortness of breath', 'Dizziness'],
  vitalSigns: { heartRate: 102, bloodPressure: 148, temperature: 98.6, respiratoryRate: 22, oxygenSaturation: 95 },
  esiLevel: 2 as const,
  disposition: 'emergency_room' as const,
  reasoning: 'Based on the reported symptoms (Chest tightness, Shortness of breath, Dizziness), the AI triage model assessed the patient\'s condition using the Emergency Severity Index (ESI). Critical symptoms detected requiring emergent evaluation. Elevated heart rate and blood pressure support the urgency classification. This assessment was processed within a TEE enclave for privacy and verified through on-chain attestation.',
  confidence: 94,
  attestation: generateAttestation(SEED + 500),
  assessedAt: Date.now() - 3600000,
  modelId: 'triage-transformer-v2.1',
};

// ============================================================
// Main Page
// ============================================================

export default function EmergencyPage() {
  const { wallet } = useApp();
  const emergency = useEmergency();

  const [activeTab, setActiveTab] = useState('emergency-card');

  const triageDisplay = emergency.triageResult ?? DEFAULT_TRIAGE;

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ---- Header ---- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Siren className="w-6 h-6 text-red-500" />
                <h1 className="text-2xl font-bold text-slate-900">Emergency & Care Coordination</h1>
              </div>
              <p className="text-sm text-slate-500">
                Emergency medical information, care team management, and AI-powered triage with TEE attestations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="error" dot>Emergency Ready</Badge>
              <TEEBadge platform="Intel SGX" verified />
            </div>
          </div>

          {/* ---- Stats ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<Heart className="w-5 h-5" />}
              label="Emergency Contacts"
              value={(emergency.emergencyCard?.emergencyContacts.length ?? 0).toString()}
              unit="contacts"
              sparklineData={[2, 2, 3, 3, 3, 3, 3, 3]}
              sparklineColor="#f43f5e"
            />
            <HealthMetricCard
              icon={<Users className="w-5 h-5" />}
              label="Care Team Members"
              value={(emergency.careTeam.filter((m) => m.isActive).length).toString()}
              unit="active"
              sparklineData={[4, 4, 5, 5, 5, 5, 5, 5]}
              sparklineColor={BRAND.sky}
            />
            <HealthMetricCard
              icon={<AlertOctagon className="w-5 h-5" />}
              label="Emergency Protocols"
              value={(emergency.protocols.length).toString()}
              unit="protocols"
              sparklineData={[4, 5, 5, 6, 6, 6, 6, 6]}
              sparklineColor="#f59e0b"
            />
            <HealthMetricCard
              icon={<Activity className="w-5 h-5" />}
              label="Care Handoffs"
              value={(emergency.handoffs.length).toString()}
              unit="records"
              sparklineData={[2, 3, 3, 4, 4, 5, 5, 5]}
              sparklineColor="#10b981"
            />
          </div>

          {/* ---- Tabs ---- */}
          <Tabs
            tabs={TAB_ITEMS}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-8"
          />

          {/* ---- Tab Content ---- */}
          {activeTab === 'emergency-card' && (
            <EmergencyCardTab emergency={emergency} />
          )}
          {activeTab === 'care-team' && (
            <CareTeamTab emergency={emergency} />
          )}
          {activeTab === 'protocols' && (
            <ProtocolsTab emergency={emergency} />
          )}
          {activeTab === 'triage' && (
            <TriageTab emergency={emergency} triageDisplay={triageDisplay} />
          )}
          {activeTab === 'handoffs' && (
            <HandoffsTab emergency={emergency} />
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// Emergency Card Tab
// ============================================================

function EmergencyCardTab({ emergency }: { emergency: ReturnType<typeof useEmergency> }) {
  if (emergency.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-2xl h-32 border border-slate-200" />
        ))}
      </div>
    );
  }

  if (!emergency.emergencyCard) {
    return (
      <MedicalCard className="text-center py-12">
        <Siren className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No emergency card configured. Connect your wallet to set up.</p>
      </MedicalCard>
    );
  }

  return <EmergencyInfoCard card={emergency.emergencyCard} />;
}

// ============================================================
// Care Team Tab
// ============================================================

function CareTeamTab({ emergency }: { emergency: ReturnType<typeof useEmergency> }) {
  return (
    <div>
      <SectionHeader
        title="Care Team"
        subtitle={`${emergency.careTeam.length} team members managing your care`}
        size="sm"
        icon={Users}
      />

      {emergency.isCareTeamLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-56 border border-slate-200" />
          ))}
        </div>
      ) : emergency.careTeam.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {emergency.careTeam.map((member) => (
            <CareTeamMemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <MedicalCard className="text-center py-12">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No care team members found.</p>
        </MedicalCard>
      )}
    </div>
  );
}

// ============================================================
// Protocols Tab
// ============================================================

function ProtocolsTab({ emergency }: { emergency: ReturnType<typeof useEmergency> }) {
  return (
    <div>
      <SectionHeader
        title="Emergency Protocols"
        subtitle={`${emergency.protocols.length} protocols with step-by-step emergency response instructions`}
        size="sm"
        icon={AlertOctagon}
      />

      {emergency.isProtocolsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-20 border border-slate-200" />
          ))}
        </div>
      ) : emergency.protocols.length > 0 ? (
        <div className="space-y-4">
          {emergency.protocols.map((protocol) => (
            <ProtocolAccordion key={protocol.id} protocol={protocol} />
          ))}
        </div>
      ) : (
        <MedicalCard className="text-center py-12">
          <AlertOctagon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No emergency protocols configured.</p>
        </MedicalCard>
      )}
    </div>
  );
}

// ============================================================
// Triage Tab
// ============================================================

function TriageTab({
  emergency,
  triageDisplay,
}: {
  emergency: ReturnType<typeof useEmergency>;
  triageDisplay: ReturnType<typeof useEmergency>['triageResult'] extends null
    ? typeof DEFAULT_TRIAGE
    : NonNullable<ReturnType<typeof useEmergency>['triageResult']>;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Triage Assessment"
        subtitle="TEE-verified emergency severity classification using the Emergency Severity Index"
        size="sm"
        icon={Activity}
      />

      {/* Current / Most Recent Triage Result */}
      <TriageResult assessment={triageDisplay as any} />

      {/* ESI Level Legend */}
      <MedicalCard>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">ESI Level Reference</h4>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {TRIAGE_LEVELS.map((level) => (
            <div
              key={level.level}
              className="flex items-center gap-2 p-2 rounded-lg"
              style={{ backgroundColor: `${level.color}10` }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: level.color }}
              >
                {level.level}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{level.label}</p>
                <p className="text-[10px] text-slate-400">{level.description}</p>
              </div>
            </div>
          ))}
        </div>
      </MedicalCard>

      {/* Triage History Table */}
      {emergency.triageHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Assessment History</h4>
          <MedicalCard padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ESI Level</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Symptoms</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Disposition</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {emergency.triageHistory.map((assessment) => {
                    const triageLevel = TRIAGE_LEVELS.find((t) => t.level === assessment.esiLevel);
                    return (
                      <tr key={assessment.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDateTime(assessment.assessedAt)}
                        </td>
                        <td className="py-3 px-4">
                          <ESILevelBadge level={assessment.esiLevel} />
                        </td>
                        <td className="py-3 px-4 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {assessment.symptoms.slice(0, 3).map((s, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                {s}
                              </span>
                            ))}
                            {assessment.symptoms.length > 3 && (
                              <span className="text-[10px] text-slate-400">+{assessment.symptoms.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700 capitalize font-medium">
                            {assessment.disposition.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${assessment.confidence}%`,
                                  backgroundColor: assessment.confidence >= 90 ? '#10b981' : assessment.confidence >= 80 ? '#eab308' : '#f43f5e',
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-700">{assessment.confidence}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </MedicalCard>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Handoffs Tab
// ============================================================

function HandoffsTab({ emergency }: { emergency: ReturnType<typeof useEmergency> }) {
  return (
    <div>
      <SectionHeader
        title="Care Handoffs"
        subtitle={`${emergency.handoffs.length} care transition records with TEE attestations`}
        size="sm"
        icon={FileText}
      />

      {emergency.isHandoffsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-48 border border-slate-200" />
          ))}
        </div>
      ) : emergency.handoffs.length > 0 ? (
        <div className="space-y-4">
          {emergency.handoffs.map((handoff) => (
            <HandoffCard key={handoff.id} handoff={handoff} />
          ))}
        </div>
      ) : (
        <MedicalCard className="text-center py-12">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No handoff records found.</p>
        </MedicalCard>
      )}
    </div>
  );
}
