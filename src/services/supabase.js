import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yvmzywbrsxzkohivholm.supabase.co';
const supabaseAnonKey = 'sb_publishable_5zo9oUte2-PK2A9nATJ_GA_hB_xIu1H';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
