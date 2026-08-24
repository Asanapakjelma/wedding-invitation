export interface RSVPData {
    guest_name: string;
    attendance_status: 'Hadir' | 'Tidak Hadir';
    total_guests: number;
    wishes: string;
}