/**
 * Dado el objeto votos (con campos individuales del INE),
 * retorna el partido/coalición con más votos.
 * @param {Object} votos
 * @returns {'PAN'|'MORENA'|'MC'|null}
 */
export const ganadorCoalicion = (votos) => {
  if (!votos) return null;
  const totales = {
    PAN:
      (votos.PAN ?? 0) + (votos.PRI ?? 0) + (votos.CC_PAN_PRI ?? 0),
    MORENA:
      (votos.PVEM ?? 0) +
      (votos.PT ?? 0) +
      (votos.MORENA ?? 0) +
      (votos.C_PVEM_PT_MORENA ?? 0) +
      (votos.C_PVEM_PT ?? 0) +
      (votos.C_PVEM_MORENA ?? 0) +
      (votos.C_PT_MORENA ?? 0),
    MC: votos.MC ?? 0,
  };
  let ganador = null,
    max = -1;
  Object.entries(totales).forEach(([p, v]) => {
    if (v > max) {
      max = v;
      ganador = p;
    }
  });
  return max > 0 ? ganador : null;
};

/**
 * Retorna los totales por candidato/coalición.
 * @param {Object} votos
 * @returns {{ PAN: number, MORENA: number, MC: number, OTROS: number, NULOS: number }}
 */
export const totalesCoalicion = (votos) => {
  if (!votos) return { PAN: 0, MORENA: 0, MC: 0, OTROS: 0, NULOS: 0 };
  return {
    PAN:
      (votos.PAN ?? 0) + (votos.PRI ?? 0) + (votos.CC_PAN_PRI ?? 0),
    MORENA:
      (votos.PVEM ?? 0) +
      (votos.PT ?? 0) +
      (votos.MORENA ?? 0) +
      (votos.C_PVEM_PT_MORENA ?? 0) +
      (votos.C_PVEM_PT ?? 0) +
      (votos.C_PVEM_MORENA ?? 0) +
      (votos.C_PT_MORENA ?? 0),
    MC: votos.MC ?? 0,
    OTROS:
      (votos.PESD ?? 0) +
      (votos.PV ?? 0) +
      (votos.PER ?? 0) +
      (votos.CAND_IND_EDRH ?? 0) +
      (votos.NO_REGISTRADAS ?? 0),
    NULOS: votos.NULOS ?? 0,
  };
};
