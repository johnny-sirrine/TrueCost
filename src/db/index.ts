import Dexie, { type EntityTable } from 'dexie';
import type { VehicleRow, GlobalAssumptions } from '../types';

class CarBoardDB extends Dexie {
  vehicles!: EntityTable<VehicleRow, 'id'>;
  assumptions!: EntityTable<GlobalAssumptions, 'id'>;

  constructor() {
    super('CarBoard');

    // Version 1: initial schema
    this.version(1).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    });

    // Version 2: add salesTaxRate to assumptions
    this.version(2).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    }).upgrade(tx => {
      return tx.table('assumptions').toCollection().modify(a => {
        if (a.salesTaxRate === undefined) {
          a.salesTaxRate = 0.0725;
        }
      });
    });

    // Version 3: update default ownership horizon to 5yr
    this.version(3).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    }).upgrade(tx => {
      return tx.table('assumptions').toCollection().modify(a => {
        if (a.ownershipYears === 3) {
          a.ownershipYears = 5;
        }
      });
    });

    // Version 4: insurance fields + current car flag
    this.version(4).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    }).upgrade(tx => {
      tx.table('assumptions').toCollection().modify(a => {
        if (a.insuranceCoverageDefault === undefined) a.insuranceCoverageDefault = 'liability_only';
        if (a.driverAgeRange === undefined) a.driverAgeRange = '25_39';
        if (a.drivingRecord === undefined) a.drivingRecord = 'clean';
      });
      tx.table('vehicles').toCollection().modify(v => {
        if (v.user && v.user.isCurrentCar === undefined) {
          v.user.isCurrentCar = false;
        }
      });
    });

    // Version 5: registration fees + parking/tolls
    this.version(5).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    }).upgrade(tx => {
      return tx.table('assumptions').toCollection().modify(a => {
        if (a.annualRegistrationFees === undefined) a.annualRegistrationFees = 200;
        if (a.monthlyParkingAndTolls === undefined) a.monthlyParkingAndTolls = 0;
      });
    });

    // Version 6: optional VIN on listing + cached history report on row.
    // No data transformation needed — both fields are optional, so
    // existing records get `undefined` by default. Schema change is
    // recorded here purely to signal the version bump to Dexie.
    this.version(6).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    });

    // Version 7: explicit modification level for repair/reserve modeling.
    // Existing rows are treated as stock so old data remains valid.
    this.version(7).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    }).upgrade(tx => {
      return tx.table('vehicles').toCollection().modify(v => {
        if (v.user && v.user.modificationLevel === undefined) {
          v.user.modificationLevel = 'stock';
        }
      });
    });

    // Version 8: explicit one-time purchase/transaction fees.
    // Existing rows default to $0 so historical totals remain unchanged.
    this.version(8).stores({
      vehicles: 'id, createdAt, updatedAt',
      assumptions: 'id',
    }).upgrade(tx => {
      return tx.table('vehicles').toCollection().modify(v => {
        if (v.user && v.user.feesCost === undefined) {
          v.user.feesCost = 0;
        }
      });
    });
  }
}

export const db = new CarBoardDB();
