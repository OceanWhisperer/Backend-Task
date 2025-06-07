const SentRequests = new Set<string>(); // set to track sent requests

export function isDuplicate(requestid: string): boolean {
    return SentRequests.has(requestid);
} // check for duplicates and return the status

export function markAsSent(requestid: string): void {
    SentRequests.add(requestid);
} // add for marking as sent