export function isOpenApiGenerationMode(): boolean {
  return process.env.OPENAPI_GENERATION_MODE === 'true';
}

export enum AppRole {
  All = 'all',
  Api = 'api',
  Worker = 'worker',
}

export function getAppRole(): AppRole {
  const role = process.env.APP_ROLE;
  if (role === AppRole.Api || role === AppRole.Worker) {
    return role;
  }
  return AppRole.All;
}

export function isApiRuntimeRole(): boolean {
  const role = getAppRole();
  return role === AppRole.All || role === AppRole.Api;
}

export function isWorkerRuntimeRole(): boolean {
  const role = getAppRole();
  return role === AppRole.All || role === AppRole.Worker;
}
