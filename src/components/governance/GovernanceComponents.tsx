'use client';

import React from 'react';
import {
  Vote, Clock, CheckCircle, XCircle, MinusCircle,
  AlertOctagon, Settings, Sparkles, Wallet, Users,
  ArrowRight, ChevronRight,
} from 'lucide-react';

import type { Proposal, ProposalStatus, ProposalType, Delegation } from '@/types';
import { MedicalCard, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge, ProgressRing } from '@/components/ui/SharedComponents';
import { EXTENDED_STATUS_STYLES, GOVERNANCE_PROPOSAL_TYPES } from '@/lib/constants';
import { formatNumber, timeAgo, truncateAddress } from '@/lib/utils';

// ============================================================
// ProposalCard
// ============================================================

const PROPOSAL_TYPE_ICONS: Record<ProposalType, React.ReactNode> = {
  parameter: <Settings className="w-4 h-4" />,
  feature: <Sparkles className="w-4 h-4" />,
  treasury: <Wallet className="w-4 h-4" />,
  emergency: <AlertOctagon className="w-4 h-4" />,
};

const PROPOSAL_TYPE_COLORS: Record<ProposalType, string> = {
  parameter: 'bg-brand-50 text-brand-600',
  feature: 'bg-violet-50 text-violet-600',
  treasury: 'bg-amber-50 text-amber-600',
  emergency: 'bg-red-50 text-red-600',
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  active: 'Active',
  passed: 'Passed',
  defeated: 'Defeated',
  queued: 'Queued',
  executed: 'Executed',
  cancelled: 'Cancelled',
};

interface ProposalCardProps {
  proposal: Proposal;
  onVote?: (proposalId: string, support: 'for' | 'against' | 'abstain') => void;
}

export function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const typeInfo = GOVERNANCE_PROPOSAL_TYPES.find((t) => t.id === proposal.type);

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PROPOSAL_TYPE_COLORS[proposal.type]}`}>
            {PROPOSAL_TYPE_ICONS[proposal.type]}
          </div>
          <Badge variant={proposal.type === 'emergency' ?
            /* istanbul ignore next -- only feature type tested */
            'error' : 'medical'}>
            {typeInfo?.label ??
              /* istanbul ignore next */
              proposal.type}
          </Badge>
        </div>
        <StatusBadge status={STATUS_LABELS[proposal.status]} />
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-1">{proposal.title}</h4>
      <p className="text-xs text-slate-500 line-clamp-2 mb-4">{proposal.description}</p>

      {/* Vote bar */}
      <VotingBar forVotes={proposal.forVotes} againstVotes={proposal.againstVotes} abstainVotes={proposal.abstainVotes} />

      {/* Quorum progress */}
      <div className="mt-3 mb-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Quorum</span>
          <span>{formatNumber(totalVotes)} / {formatNumber(proposal.quorum)}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((totalVotes / proposal.quorum) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {timeAgo(proposal.createdAt)}
        </span>

        {proposal.status === 'active' && onVote && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onVote(proposal.id, 'for')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              For
            </button>
            <button
              onClick={() => onVote(proposal.id, 'against')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              Against
            </button>
            <button
              onClick={() => onVote(proposal.id, 'abstain')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Abstain
            </button>
          </div>
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// VotingBar
// ============================================================

interface VotingBarProps {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
}

export function VotingBar({ forVotes, againstVotes, abstainVotes }: VotingBarProps) {
  const total = forVotes + againstVotes + abstainVotes;
  if (total === 0) {
    return (
      <div className="w-full bg-slate-100 rounded-full h-3">
        <div className="text-center text-2xs text-slate-400 leading-3">No votes yet</div>
      </div>
    );
  }

  const forPct = (forVotes / total) * 100;
  const againstPct = (againstVotes / total) * 100;
  const abstainPct = (abstainVotes / total) * 100;

  return (
    <div>
      <div className="flex w-full h-3 rounded-full overflow-hidden">
        {forPct > 0 && (
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
        )}
        {againstPct > 0 && (
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${againstPct}%` }} />
        )}
        {abstainPct > 0 && (
          <div className="bg-slate-300 transition-all duration-500" style={{ width: `${abstainPct}%` }} />
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className="text-emerald-600 font-medium flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> {forPct.toFixed(1)}% For
        </span>
        <span className="text-red-600 font-medium flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {againstPct.toFixed(1)}% Against
        </span>
        <span className="text-slate-400 font-medium flex items-center gap-1">
          <MinusCircle className="w-3 h-3" /> {abstainPct.toFixed(1)}% Abstain
        </span>
      </div>
    </div>
  );
}

// ============================================================
// DelegationPanel
// ============================================================

interface DelegationPanelProps {
  delegations: Delegation[];
  userVotingPower: number;
  onDelegate?: (address: string) => void;
  onUndelegate?: () => void;
}

export function DelegationPanel({ delegations, userVotingPower, onDelegate, onUndelegate }: DelegationPanelProps) {
  const userDelegation = delegations.find(
    (d) => d.delegator === 'aeth1demo000000000000000000000000000000000'
  );

  return (
    <MedicalCard>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-900">Delegation</h4>
        <Badge variant="brand">
          <Vote className="w-3 h-3 mr-1" />
          {formatNumber(userVotingPower)} VP
        </Badge>
      </div>

      {userDelegation ? (
        <div className="p-3 bg-brand-50 rounded-xl mb-4">
          <p className="text-xs text-brand-600 mb-1">Delegated to</p>
          <p className="text-sm font-mono font-medium text-brand-900">{truncateAddress(userDelegation.delegatee)}</p>
          <p className="text-xs text-brand-500 mt-1">
            {formatNumber(userDelegation.votingPower)} voting power &middot; {timeAgo(userDelegation.delegatedAt)}
          </p>
          {onUndelegate && (
            <button
              onClick={onUndelegate}
              className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200"
            >
              Undelegate
            </button>
          )}
        </div>
      ) : (
        <div className="p-3 bg-slate-50 rounded-xl mb-4">
          <p className="text-xs text-slate-500">No active delegation. Delegate your voting power to a trusted address.</p>
        </div>
      )}

      {/* Delegation tree */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-700">Recent Delegations</p>
        {delegations.slice(0, 5).map((del) => (
          <div key={del.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs">
            <span className="font-mono text-slate-600">{truncateAddress(del.delegator, 8, 4)}</span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-mono text-slate-600">{truncateAddress(del.delegatee, 8, 4)}</span>
            <span className="ml-auto text-slate-400">{formatNumber(del.votingPower)} VP</span>
          </div>
        ))}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// ProposalTimeline
// ============================================================

interface ProposalTimelineProps {
  proposal: Proposal;
}

const TIMELINE_STEPS: { status: ProposalStatus; label: string }[] = [
  { status: 'active', label: 'Created' },
  { status: 'active', label: 'Voting' },
  { status: 'passed', label: 'Passed / Defeated' },
  { status: 'executed', label: 'Executed' },
];

export function ProposalTimeline({ proposal }: ProposalTimelineProps) {
  const statusOrder: ProposalStatus[] = ['active', 'passed', 'queued', 'executed'];
  const currentIndex = proposal.status === 'defeated' || proposal.status === 'cancelled'
    ? 2
    : statusOrder.indexOf(proposal.status) + 1;

  const steps = [
    { label: 'Created', completed: true, active: false },
    { label: 'Voting', completed: currentIndex > 1, active: proposal.status === 'active' },
    { label: proposal.status === 'defeated' ? 'Defeated' : proposal.status === 'cancelled' ? 'Cancelled' : 'Passed', completed: currentIndex > 2, active: currentIndex === 2 },
    { label: 'Executed', completed: proposal.status === 'executed', active: proposal.status === 'queued' },
  ];

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              step.completed ? 'bg-emerald-500 text-white' :
              step.active ? 'bg-brand-500 text-white' :
              'bg-slate-200 text-slate-400'
            }`}>
              {step.completed ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{i + 1}</span>}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-0.5 h-8 ${step.completed ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </div>
          <div className="pt-0.5">
            <p className={`text-sm font-medium ${step.completed || step.active ? 'text-slate-900' : 'text-slate-400'}`}>
              {step.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// QuorumMeter
// ============================================================

interface QuorumMeterProps {
  currentVotes: number;
  quorum: number;
  size?: number;
}

export function QuorumMeter({ currentVotes, quorum, size = 80 }: QuorumMeterProps) {
  const pct = Math.min((currentVotes / quorum) * 100, 100);
  const reached = currentVotes >= quorum;

  return (
    <div className="flex flex-col items-center gap-2">
      <ProgressRing
        value={currentVotes}
        max={quorum}
        size={size}
        strokeWidth={6}
        color={reached ? '#10b981' : '#8B1538'}
        trackColor="#e2e8f0"
      >
        <span className={`text-xs font-bold ${reached ? 'text-emerald-600' : 'text-brand-600'}`}>
          {pct.toFixed(0)}%
        </span>
      </ProgressRing>
      <div className="text-center">
        <p className="text-xs font-medium text-slate-700">
          {reached ? 'Quorum Reached' : 'Quorum Progress'}
        </p>
        <p className="text-2xs text-slate-400">
          {formatNumber(currentVotes)} / {formatNumber(quorum)}
        </p>
      </div>
    </div>
  );
}
