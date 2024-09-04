import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dxusbfemztqipqvlneat.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE
const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
