declare module "zkteco-js" {
  export interface ZkUser {
    uid: number;
    role: number;
    password: string;
    name: string;
    cardno: number;
    userId: string;
  }
  export interface ZkRecord {
    sn: number;
    user_id: string;
    record_time: string;
    type: number;
    state: number;
    ip: string;
  }
  export default class Zkteco {
    constructor(ip: string, port: number, timeout: number, inport: number, maxChunk?: number);
    createSocket(cbErr?: (e: unknown) => void, cbClose?: (e: unknown) => void): Promise<boolean>;
    getUsers(): Promise<{ data: ZkUser[] }>;
    getAttendances(cb?: (percent: number, total: number) => void): Promise<{ data: ZkRecord[] }>;
    setUser(uid: number, userid: string, name: string, password: string, role?: number, cardno?: number): Promise<unknown>;
    deleteUser(uid: number): Promise<unknown>;
    getTime(): Promise<Date>;
    setTime(t: Date): Promise<unknown>;
    getInfo(): Promise<{ userCounts: number; logCounts: number; logCapacity: number }>;
    disconnect(): Promise<void>;
  }
}
