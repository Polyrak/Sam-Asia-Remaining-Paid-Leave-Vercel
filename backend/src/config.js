import 'dotenv/config';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy backend/.env.example to backend/.env and fill it in.`);
  }
  return value;
}

export const config = {
  openProjectUrl: requireEnv('OPENPROJECT_URL').replace(/\/+$/, ''),
  openProjectApiKey: requireEnv('OPENPROJECT_API_KEY'),
  port: Number(process.env.PORT) || 4000,
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 60,
  leave: {
    // Project whose members make up the employee list (fetched via project
    // memberships, since this API key can't list all OpenProject users).
    projectId: process.env.OP_LEAVE_PROJECT_ID || '',
    // Work package that employees log their paid leave time entries against
    // (e.g. a shared "Paid leave" work package under the LEAVES type).
    paidLeaveWorkPackageId: process.env.OP_PAID_LEAVE_WORK_PACKAGE_ID || '',
    hoursPerDay: Number(process.env.OP_HOURS_PER_DAY) || 8,
  },
};

export function isLeaveConfigured() {
  return Boolean(config.leave.projectId && config.leave.paidLeaveWorkPackageId);
}
