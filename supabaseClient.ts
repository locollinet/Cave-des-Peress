import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rdgmixwthjgsjhfkadtp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZ21peHd0aGpnc2poZmthZHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjkyNjcsImV4cCI6MjA4MDgwNTI2N30.Ws5pO3odaNmz8Mo5hXVGnlDss_VHawbsZ1Qr2yiJoYQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);