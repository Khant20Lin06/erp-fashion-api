import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { JournalSourceType } from '../entities/journal-source-type.enum';
import { JournalReferenceType } from '../entities/journal-reference-type.enum';

export interface JournalEntryLineResponseDto {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  referenceType: JournalReferenceType | null;
  referenceId: string | null;
  description: string | null;
  createdAt: Date;
}

export interface JournalEntryResponseDto {
  id: string;
  journalNumber: string;
  companyId: string;
  branchId: string | null;
  accountingPeriodId: string;
  entryDate: Date;
  status: JournalEntryStatus;
  sourceType: JournalSourceType | null;
  sourceId: string | null;
  description: string;
  totalDebit: string;
  totalCredit: string;
  createdBy: string;
  postedBy: string | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: JournalEntryLineResponseDto[];
}

function toLineDto(line: JournalEntryLine): JournalEntryLineResponseDto {
  return {
    id: line.id,
    accountId: line.accountId,
    debitAmount: line.debitAmount,
    creditAmount: line.creditAmount,
    referenceType: line.referenceType,
    referenceId: line.referenceId,
    description: line.description,
    createdAt: line.createdAt,
  };
}

export function toJournalEntryResponseDto(
  entry: JournalEntry,
): JournalEntryResponseDto {
  return {
    id: entry.id,
    journalNumber: entry.journalNumber,
    companyId: entry.companyId,
    branchId: entry.branchId,
    accountingPeriodId: entry.accountingPeriodId,
    entryDate: entry.entryDate,
    status: entry.status,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    description: entry.description,
    totalDebit: entry.totalDebit,
    totalCredit: entry.totalCredit,
    createdBy: entry.createdBy,
    postedBy: entry.postedBy,
    postedAt: entry.postedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lines: entry.lines?.map(toLineDto),
  };
}
