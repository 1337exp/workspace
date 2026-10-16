import { createSavedStorage } from '@1337exp/taoux/storage';

const storage = createSavedStorage('workspace.state');

export const readSaved = storage.read;
export const writeSaved = storage.write;
export const backupBroken = storage.backupBroken;
