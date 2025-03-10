import { bool } from "aws-sdk/clients/signer";

export interface ChargerPoint {
    id: number;
    charge_point_id:string | null,
    station_id: number | null;
    serial_number: string | null;
    model: string | null;
    manufacturer_name: string | null;
    created_at: Date | null;
    created_by: string | null;
    updated_at: Date | null;
    updated_by: string | null;
    charge_point_id_oltp: number | null;
    peak_power_in_kW: string | null;
    ac_input_voltage: number | null;
    ac_max_current: string | null;
    voltage_range_min: number | null;
    voltage_range_max: number | null;
    warranty_end_date: Date | null;
    current_rating: number | null;
    oem: string | null;
    energy_sold: number | null;
    total_sessions: number | null;
    last_heartbeat_received: Date | null;
    charger_type: string | null;
    peak_current: number | null;
    peak_voltage: number | null;
    r_one_score: number | null;
    make: string | null;
    commissioned_date: Date | null;
    average_utilization_per_day: number | null;
    firmware_version: string | null;
    latitude: number | null;
    longitude: number | null;
    station_id_oltp: number | null;
    created_by_oltp: number | null;
    updated_by_oltp: number | null;
    is_published: boolean | null;
    is_serial_number_temporary: boolean | null;
    last_recurrence_service_date: Date | null;
    next_maintenance_date: Date | null;
  }


export interface Stations {
    id: number;
    name: string | null;
    station_id_oltp: number | null;
    address: string | null;
    level_3_id: number | null;
    latitude: number | null;
    longitude: number | null;
    created_at: Date | null;
    updated_at: Date | null;
    agreement_type: string | null;
    what3words_location: string | null;
    is_active: boolean | null;
    is_stabilizer_installed: boolean | null;
    is_diesel_generator_available: boolean | null;
    sessions: number | null;
    energy_sold: number | null;
    station_contact: number | null;
    street: string | null;
    area: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    pincode: number | null;
    landmark: string | null;
}

export interface Connectors {
    id: number;
    connector_id_oltp: number | null;
    ocpp_charge_point_id: string | null;
    serial_number: string | null;
    connector_id_in_charger: number | null;
    connector_type: string | null;
    current_status: string | null;
    peak_power_in_kW: number | null;
    peak_current: number | null;
    peak_voltage: number | null;
    created_by: number | null;
    updated_by: number | null;
    created_at: Date | null;
    updated_at: Date | null;
}

export interface Users{
    id:number|null,
    uuid:string|null,
    full_name:string|null,
    account_verified:boolean|null,
    phone:string | null,
    email:string|null,
    user_role:string|null,
    is_available:boolean|null,
    base_location: any,
    live_location: any,
    created_at:Date|null,
    updated_at:Date|null
}