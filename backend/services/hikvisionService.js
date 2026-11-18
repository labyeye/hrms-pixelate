// Getting people onto a Hikvision terminal. Two routes:
//  1. site agent (hikvision-agent/agent.js) polls us and pushes on its own LAN. Works for any client, no VPN.
//  2. direct ISAPI from this server, only when the device IP is reachable from here.
// Inbound punches use hikvisionPunch, not this file.
const Company = require("../models/Company");
const HikvisionJob = require("../models/HikvisionJob");
const { encryptBuffer, decryptBuffer } = require("../utils/docVault");
const isapi = require("../../hikvision-agent/isapi");

const AGENT_ALIVE_MS = 2 * 60 * 1000;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

const sealPassword = (p) => encryptBuffer(Buffer.from(p, "utf8")).toString("base64");
const openPassword = (s) => decryptBuffer(Buffer.from(s, "base64")).toString("utf8");

async function getDevice(companyId) {
  const c = await Company.findById(companyId).select("+hikvisionDevice.passwordEnc").lean();
  const d = c?.hikvisionDevice;
  if (!d?.host || !d.username || !d.passwordEnc) return null;
  return { host: d.host, port: d.port, https: !!d.https, username: d.username, password: openPassword(d.passwordEnc) };
}

async function agentAlive(companyId) {
  const c = await Company.findById(companyId).select("hikvisionAgentSeen").lean();
  return !!c?.hikvisionAgentSeen && Date.now() - new Date(c.hikvisionAgentSeen) < AGENT_ALIVE_MS;
}

const jobFor = (companyId, type, emp, image) => ({
  company: companyId,
  type,
  employeeId: String(emp.employeeId),
  name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
  ...(image ? { image: image.toString("base64") } : {}),
});

// Queue user (+ face) jobs for the agent.
async function enqueue(companyId, emp, jpeg) {
  const docs = [jobFor(companyId, "user", emp)];
  if (jpeg && jpeg.length <= MAX_IMAGE_BYTES) docs.push(jobFor(companyId, "face", emp, jpeg));
  await HikvisionJob.insertMany(docs);
}

// Fire-and-forget hook for employee create / face enrol: never throws.
async function safePush(companyId, emp, jpeg) {
  try {
    if (await agentAlive(companyId)) return await enqueue(companyId, emp, jpeg);
    const dev = await getDevice(companyId);
    if (!dev) return;
    await isapi.pushUser(dev, emp);
    if (jpeg) await isapi.pushFace(dev, emp, jpeg);
  } catch (e) {
    console.warn(`[HIKVISION] push failed for ${emp.employeeId}: ${e.message}`);
  }
}

module.exports = { sealPassword, getDevice, agentAlive, enqueue, safePush, testDevice: isapi.testDevice, pushUser: isapi.pushUser, pushFace: isapi.pushFace };
