// Fix: Augment the global Window interface to include the gapi object
// This resolves TypeScript errors about 'gapi' not existing on 'window'.
declare global {
  interface Window {
    gapi: any;
  }
}

export interface ReelState {
  id: number;
  length: string; // Current length, as string for controlled input
}

export interface CutRequest {
  id: number;
  name: string;
  length: string; // Required length, as string for controlled input
}

export interface CutLogEntry {
  id: number | string;
  name: string;
  length: number;
  reelId: number;
  startIndex: number;
  endIndex: number;
  timestamp: string;
}

// Add: Define a type for the cut log summary object
export interface CutLogSummary {
    totalCuts: number;
    totalLength: number;
}

// Types for the calculation result
export interface ParsedCut {
  id: number;
  name: string;
  length: number;
}

export interface AllocatedCut extends ParsedCut {
  startIndex: number;
  endIndex: number;
}

export interface ParsedReel {
    id: number;
    length: number;
    startIndex: number;
    endIndex: number;
}

export interface AllocationDetail {
    assignedCuts: AllocatedCut[];
    remaining: number;
    newStartIndex: number;
}

export interface Allocation {
    [key: number]: AllocationDetail;
}

export interface AllocationResult {
    success: boolean;
    allocation: Allocation;
    unallocatedCuts: ParsedCut[];
    reelsBefore: ParsedReel[];
    warnings?: string[];
}