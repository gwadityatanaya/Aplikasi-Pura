import "server-only";
import { coreCommands, type Handler } from "./commands";
import { adminCommands } from "./commands-admin";
import { puniaCommands } from "./commands-punia";
import { accountCommands } from "./commands-account";

/** Every command the app can send to POST /api/commands. Each one checks permissions itself. */
export const commands: Record<string, Handler> = { ...coreCommands, ...adminCommands, ...puniaCommands, ...accountCommands };

/** Back Office commands are Admin Utama's own work — never labelled as "mode darurat". */
export const backOfficeCommands = new Set(Object.keys(adminCommands));
