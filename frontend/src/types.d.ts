declare module 'snarkjs' {
  export const groth16: {
    fullProve: (
      input: any,
      wasmPath: string,
      zkeyPath: string
    ) => Promise<{ proof: any; publicSignals: string[] }>;
    verify: (vKey: any, publicSignals: string[], proof: any) => Promise<boolean>;
  };
}

declare module 'circomlibjs' {
  export function buildEddsa(): Promise<any>;
  export function buildBabyjub(): Promise<any>;
  export function buildPoseidon(): Promise<any>;
}
