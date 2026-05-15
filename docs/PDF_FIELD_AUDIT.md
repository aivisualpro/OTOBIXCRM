# PDF Field Audit — `CarInspectionView.vue` `#pdf-container`

> **Generated**: 2026-05-15  
> **Source**: `app/components/CarInspectionView.vue` (4544 lines)  
> **PDF template**: lines 4315–4469  

Legend: ✅ = in PDF | ❌ = **MISSING from PDF** | 🟡 = partially rendered

---

## 1. Vehicle Identity (Header fields from Details tab)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `make` | Make | ✅ | Header line 4328 |
| 2 | `model` | Model | ✅ | Header line 4328 |
| 3 | `variant` | Variant | ✅ | Header line 4328 |
| 4 | `yearMonthOfManufacture` | MFG Year | ✅ | Header line 4328 (year only) |
| 5 | `registrationNumber` | Registration Number | ❌ | **Missing** |
| 6 | `registrationDate` | Registration Date | ❌ | **Missing** |
| 7 | `appointmentSource` | Source | ❌ | **Missing** |
| 8 | `registeredOwner` | Registered Owner | ❌ | **Missing** |
| 9 | `ownerSerialNumber` | Owner Serial Number | ❌ | **Missing** |
| 10 | `city` | City | 🟡 | Only in header subtext (line 4331) |
| 11 | `odometerReadingInKms` | Odometer Reading (KMs) | ❌ | **Missing** |
| 12 | `inspectionDate` / `createdAt` | Inspection Date | ✅ | Header line 4331 |
| 13 | `appointmentId` | Appointment ID | ❌ | **Missing** |
| 14 | `inspectionStatus` | Inspection Status | ❌ | **Missing** |

---

## 2. Registration & Technical Specs (`documentDetailFields` → `technicalSpecs` + `registrationDetails`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `fuelType` | Fuel Type | ✅ | Via documentDetailFields flatMap |
| 2 | `seatingCapacity` | Seating Capacity | ✅ | Via documentDetailFields flatMap |
| 3 | `color` | Color | ✅ | Via documentDetailFields flatMap |
| 4 | `fitnessValidity` | Fitness Validity | ✅ | Via documentDetailFields flatMap |
| 5 | `engineNumber` | Engine Number | ✅ | Via documentDetailFields flatMap |
| 6 | `chassisNumber` | Chassis Number | ✅ | Via documentDetailFields flatMap |
| 7 | `cubicCapacity` | Cubic Capacity | ✅ | Via documentDetailFields flatMap |
| 8 | `norms` | Norms | ✅ | Via documentDetailFields flatMap |
| 9 | `registrationState` | Registration State | ✅ | Via documentDetailFields flatMap |
| 10 | `registeredRto` | Registered RTO | ✅ | Via documentDetailFields flatMap |
| 11 | `registeredAddressAsPerRc` | Registered Address | ✅ | Via documentDetailFields flatMap |

---

## 3. Insurance & Hypothecation (`documentDetailFields`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `hypothecationDetails` | Hypothecation Details | ✅ | |
| 2 | `hypothecatedTo` | Hypothecated To | ✅ | |
| 3 | `insuranceDropdownList` | Insurance Type | ✅ | |
| 4 | `insuranceValidity` | Insurance Validity | ✅ | |
| 5 | `insurer` | Insured By | ✅ | |
| 6 | `policyNumber` | Policy Number | ✅ | |

---

## 4. Documents & Compliance (`documentDetailFields`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `toBeScrapped` | To Be Scrapped | ✅ | |
| 2 | `chassisDetails` | Chassis Details | ✅ | |
| 3 | `vinPlateDetails` | Vin Plate Details | ✅ | |
| 4 | `rcBookAvailabilityDropdownList` | RC Book Availability | ✅ | |
| 5 | `rcCondition` | RC Condition | ✅ | |
| 6 | `mismatchInRcDropdownList` | Mismatch in RC | ✅ | |
| 7 | `roadTaxValidity` | Road Tax Validity | ✅ | |
| 8 | `taxValidTill` | Tax Valid Till | ✅ | |
| 9 | `pucValidity` | PUC Validity | ✅ | |
| 10 | `pucNumber` | PUC Number | ✅ | |
| 11 | `rcStatus` | RC Status | ✅ | |
| 12 | `blacklistStatus` | Blacklist Status | ✅ | |
| 13 | `rtoNoc` | RTO NOC Details | ✅ | |
| 14 | `rtoForm28` | RTO Form 28 | ✅ | |
| 15 | `partyPeshi` | Party Peshi | ✅ | |
| 16 | `duplicateKey` | Duplicate Key | ✅ | |
| 17 | `additionalDetailsDropdownList` | Additional Details | ✅ | |

---

## 5. Exterior Condition — Front (`exteriorSections[0].parts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `frontMainImages` | Front Main | ✅ | isImageOnly, rendered |
| 2 | `bonnetDropdownList` | Bonnet | ✅ | But `imageGroups` not iterated — only `imageKey` fallback |
| 3 | `frontWindshieldDropdownList` | Front Windshield | ✅ | |
| 4 | `frontWiperAndWasherDropdownList` | Front Wiper & Washer | ✅ | |
| 5 | `roofDropdownList` | Roof | ✅ | |
| 6 | `frontBumperDropdownList` | Front Bumper | ✅ | `imageGroups` not iterated in PDF |
| 7 | `lhsHeadlampDropdownList` | LHS Headlamp | ✅ | |
| 8 | `lhsFoglampDropdownList` | LHS Foglamp | ✅ | |
| 9 | `rhsHeadlampDropdownList` | RHS Headlamp | ✅ | |
| 10 | `rhsFoglampDropdownList` | RHS Foglamp | ✅ | |

---

## 6. Exterior Condition — Left (LHS) (`exteriorSections[1].parts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `lhsFullViewImages` | LHS Full View | ✅ | isImageOnly |
| 2 | `lhsFenderDropdownList` | LHS Fender | ✅ | |
| 3 | `lhsFrontWheelDropdownList` | LHS Front Wheel | ✅ | |
| 4 | `lhsFrontTyreDropdownList` | LHS Front Tyre | ✅ | |
| 5 | `lhsOrvmDropdownList` | LHS ORVM | ✅ | |
| 6 | `lhsAPillarDropdownList` | LHS A-Pillar | ✅ | |
| 7 | `lhsFrontDoorDropdownList` | LHS Front Door | ✅ | |
| 8 | `lhsBPillarDropdownList` | LHS B-Pillar | ✅ | |
| 9 | `lhsRearDoorDropdownList` | LHS Rear Door | ✅ | |
| 10 | `lhsCPillarDropdownList` | LHS C-Pillar | ✅ | |
| 11 | `lhsRunningBorderDropdownList` | LHS Running Border | ✅ | |
| 12 | `lhsRearWheelDropdownList` | LHS Rear Wheel | ✅ | |
| 13 | `lhsRearTyreDropdownList` | LHS Rear Tyre | ✅ | |
| 14 | `lhsQuarterPanelDropdownList` | LHS Quarter Panel | ✅ | `imageGroups` not iterated |

---

## 7. Exterior Condition — Rear (`exteriorSections[2].parts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `rearMainImages` | Rear Main | ✅ | isImageOnly |
| 2 | `rearBumperDropdownList` | Rear Bumper | ✅ | `imageGroups` not iterated |
| 3 | `lhsTailLampDropdownList` | LHS Tail Lamp | ✅ | |
| 4 | `lhsRearFogLampDropdownList` | LHS Rear Fog Lamp | ✅ | |
| 5 | `rhsTailLampDropdownList` | RHS Tail Lamp | ✅ | |
| 6 | `rhsRearFogLampDropdownList` | RHS Rear Fog Lamp | ✅ | |
| 7 | `rearWindshieldDropdownList` | Rear Windshield | ✅ | |
| 8 | `bootDoorDropdownList` | Boot Door | ✅ | `imageGroups` not iterated |
| 9 | `spareWheelDropdownList` | Spare Wheel | ✅ | |
| 10 | `spareTyreDropdownList` | Spare Tyre | ✅ | |
| 11 | `bootFloorDropdownList` | Boot Floor | ✅ | |

---

## 8. Exterior Condition — Right (RHS) (`exteriorSections[3].parts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `rhsFullViewImages` | RHS Full View | ✅ | isImageOnly |
| 2 | `rhsQuarterPanelDropdownList` | RHS Quarter Panel | ✅ | `imageGroups` not iterated |
| 3 | `rhsRearWheelDropdownList` | RHS Rear Wheel | ✅ | |
| 4 | `rhsRearTyreDropdownList` | RHS Rear Tyre | ✅ | |
| 5 | `rhsRunningBorderDropdownList` | RHS Running Border | ✅ | |
| 6 | `rhsCPillarDropdownList` | RHS C Pillar | ✅ | |
| 7 | `rhsRearDoorDropdownList` | RHS Rear Door | ✅ | |
| 8 | `rhsBPillarDropdownList` | RHS B Pillar | ✅ | |
| 9 | `rhsFrontDoorDropdownList` | RHS Front Door | ✅ | |
| 10 | `rhsAPillarDropdownList` | RHS A Pillar | ✅ | |
| 11 | `rhsOrvmDropdownList` | RHS ORVM | ✅ | |
| 12 | `rhsFrontWheelDropdownList` | RHS Front Wheel | ✅ | |
| 13 | `rhsFrontTyreDropdownList` | RHS Front Tyre | ✅ | |
| 14 | `rhsFenderDropdownList` | RHS Fender | ✅ | |

---

## 9. Engine Bay (`exteriorSections[4].parts` = `engineParts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `engineDropdownList` | Engine | ✅ | |
| 2 | `engineVideosBox` | Engine Videos | ❌ | `isVideoBox` — **explicitly skipped** by PDF template |
| 3 | `commentsOnEngineDropdownList` | Comment on Engine | ✅ | via splitParts |
| 4 | `engineOilLevelDipstickDropdownList` | Engine Oil Level Dipstick | ✅ | via splitParts |
| 5 | `engineOilDropdownList` | Engine Oil | ✅ | via splitParts |
| 6 | `commentsOnEngineOilDropdownList` | Comment on Engine Oil | ✅ | via splitParts |
| 7 | `enginePermisableBlowByDropdownList` | Engine Permisable Blowby | ✅ | via splitParts |
| 8 | `coolantDropdownList` | Coolant | ✅ | via splitParts |
| 9 | `cowlTopDropdownList` | Cowl Top | ✅ | |
| 10 | `firewallDropdownList` | Firewall | ✅ | |
| 11 | `lhsApronDropdownList` | LHS Apron | ✅ | |
| 12 | `rhsApronDropdownList` | RHS Apron | ✅ | |
| 13 | `batteryDropdownList` | Battery | ✅ | |
| 14 | `abs` | ABS | ✅ | via splitParts |
| 15 | `upperCrossMemberDropdownList` | Upper Cross Member | ✅ | via splitParts |
| 16 | `lhsSideMemberDropdownList` | LHS Side Member | ✅ | via splitParts |
| 17 | `rhsSideMemberDropdownList` | RHS Side Member | ✅ | via splitParts |
| 18 | `engineMountDropdownList` | Engine Mount | ✅ | via splitParts |
| 19 | `headlightSupportDropdownList` | Headlamp Support | ✅ | via splitParts |
| 20 | `radiatorSupportDropdownList` | Radiator Support | ✅ | via splitParts |
| 21 | `commentsOnRadiatorDropdownList` | Comment on Radiator | ✅ | via splitParts |
| 22 | `lowerCrossMemberDropdownList` | Lower Cross Member | ✅ | via splitParts |
| 23 | `exhaustSmokeDropdownList` | Exhaust Smoke | ✅ | via splitParts |
| 24 | `commentsOnTowingDropdownList` | Comment on Towing | ✅ | via splitParts |
| 25 | `commentsOnOthersDropdownList` | Comment on Others | ✅ | via splitParts |

---

## 10. Electricals / AC (`exteriorSections[5].parts` = `electricalParts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `commentsOnClusterMeterDropdownList` | Cluster Meter | ✅ | via clusterMeterGroup splitParts |
| 2 | `odometerReadingBeforeTestDrive` | Odometer Reading | ✅ | via splitParts |
| 3 | `fuelLevel` | Fuel Level | ✅ | via splitParts |
| 4 | `irvm` | IRVM | ✅ | via splitParts |
| 5 | `dashboardDropdownList` | Dashboard | ✅ | via splitParts |
| 6 | `infotainmentSystemDropdownList` | Infotainment System | ✅ | via splitParts |
| 7 | `inbuiltSpeaker` | Inbuilt Speaker | ✅ | via splitParts |
| 8 | `externalSpeaker` | External Speaker | ✅ | via splitParts |
| 9 | `steeringMountedMediaControls` | Steering Audio Controls | ✅ | via splitParts |
| 10 | `steeringMountedSystemControls` | Steering System Controls | ✅ | via splitParts |
| 11 | `acTypeDropdownList` | AC Type | ✅ | via splitParts |
| 12 | `acCoolingDropdownList` | AC Cooling | ✅ | via splitParts |
| 13 | `commentsOnAc` | Comment on AC | ✅ | |
| 14 | `rearWiperWasherDropdownList` | Rear Wiper & Washer | ✅ | |
| 15 | `reverseCameraDropdownList` | Reverse Camera | ✅ | |
| 16 | `sunroofDropdownList` | Sunroof | ✅ | |
| 17 | `rearDefoggerDropdownList` | Rear Defogger | ✅ | via splitParts |
| 18 | `rhsFrontDoorFeaturesDropdownList` | Driver Door Features | ✅ | via splitParts |
| 19 | `lhsFrontDoorFeaturesDropdownList` | Co-Driver Door Features | ✅ | via splitParts |
| 20 | `rhsRearDoorFeaturesDropdownList` | RHS Rear Door Features | ✅ | via splitParts |
| 21 | `noOfPowerWindows` | Power Windows | ✅ | via splitParts |
| 22 | `lhsRearDoorFeaturesDropdownList` | LHS Rear Door Features | ✅ | via splitParts |

---

## 11. Interior Condition (`exteriorSections[6].parts` = `interiorParts`)

> **CRITICAL**: The PDF template only renders parts with `splitParts` or normal keys. All `isFourPanel` parts are **silently skipped** because the PDF template has no `v-if="(part as any).isFourPanel"` branch.

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `noOfAirBags` | Number of Airbags | ❌ | **isFourPanel — skipped** |
| 2 | `commentOnInterior` | Comment on Interior | ❌ | **isFourPanel — skipped** |
| 3 | `driverAirbagDropdownList` | Driver Airbag | ❌ | **isFourPanel — skipped** |
| 4 | `coDriverAirbagDropdownList` | Co-Driver Airbag | ❌ | **isFourPanel — skipped** |
| 5 | `driverSeatAirbagDropdownList` | Driver Seat Airbag | ❌ | **isFourPanel — skipped** |
| 6 | `coDriverSeatAirbagDropdownList` | Co-Driver Seat Airbag | ❌ | **isFourPanel — skipped** |
| 7 | `rhsCurtainAirbagDropdownList` | RHS Curtain Airbag | ❌ | **isFourPanel — skipped** |
| 8 | `lhsCurtainAirbagDropdownList` | LHS Curtain Airbag | ❌ | **isFourPanel — skipped** |
| 9 | `driverSideKneeAirbag` | Driver Knee Airbag | ❌ | **isFourPanel — skipped** |
| 10 | `coDriverKneeSeatAirbag` | Co-Driver Knee Airbag | ❌ | **isFourPanel — skipped** |
| 11 | `rhsRearSideAirbag` | RHS Rear Side Airbag | ❌ | **isFourPanel — skipped** |
| 12 | `lhsRearSideAirbag` | LHS Rear Side Airbag | ❌ | **isFourPanel — skipped** |
| 13 | `seatsUpholstery` | Seat Upholstery | ❌ | **isFourPanel — skipped** |
| 14 | `driverSeatDropdownList` | Driver Seat | ❌ | **isFourPanel — skipped** |
| 15 | `coDriverSeatDropdownList` | Co-Driver Seat | ❌ | **isFourPanel — skipped** |
| 16 | `frontCentreArmRestDropdownList` | Front Centre Arm Rest | ❌ | **isFourPanel — skipped** |
| 17 | `rearSeatsDropdownList` | Rear Seats | ❌ | **isFourPanel — skipped** |
| 18 | `thirdRowSeatsDropdownList` | Third Row Seats | ❌ | **isFourPanel — skipped** |
| 19 | `frontSeatsFromDriverSideImages` | Front Seats (Driver Side) | ✅ | isImageOnly — rendered |
| 20 | `rearSeatsFromRightSideImages` | Rear Seats (Right Side) | ✅ | isImageOnly — rendered |
| 21 | `dashboardImages` | Dashboard from Rear Seat | ✅ | isImageOnly — rendered |

---

## 12. Steering, Suspension & Brakes (`exteriorSections[7].parts`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `steeringDropdownList` | Steering | ✅ | via splitParts |
| 2 | `suspensionDropdownList` | Suspension | ✅ | via splitParts |
| 3 | `brakesDropdownList` | Brakes | ✅ | via splitParts |
| 4 | `clutchDropdownList` | Clutch | ✅ | via splitParts |
| 5 | `gearShiftDropdownList` | Gear Shift | ✅ | via splitParts |
| 6 | `transmissionTypeDropdownList` | Transmission Type | ✅ | via splitParts |
| 7 | `driveTrainDropdownList` | Drive Train | ✅ | via splitParts |
| 8 | `commentsOnTransmission` | Comment on Transmission | ✅ | via splitParts |
| 9 | `odometerReadingAfterTestDriveInKms` | Odometer After Test Drive | ✅ | |

---

## 13. Engine Videos (`engineVideoKeys`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `engineVideo` | Engine Sound Video | ❌ | **Videos cannot render in static PDF** |
| 2 | `exhaustSmokeVideo` | Exhaust Smoke Video | ❌ | **Videos cannot render in static PDF** |

---

## 14. Valuation / Pricing (from `editForm` in `confirmQCApproval`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `priceDiscovery` | Price Discovery | ❌ | **Missing** |
| 2 | `priceDiscoveryBy` | Price Discovery By | ❌ | **Missing** |
| 3 | `retailAssociate` | Retail Associate | ❌ | **Missing** |
| 4 | `retailAssociateContactNumber` | Retail Associate Contact | ❌ | **Missing** |

---

## 15. QC / Approval Metadata (from `editForm` in approval flows)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `approvalStatus` | Approval Status | ❌ | **Missing** |
| 2 | `approvalDate` | Approval Date | ❌ | **Missing** |
| 3 | `approvalTime` | Approval Time | ❌ | **Missing** |
| 4 | `approvedBy` | Approved By | ❌ | **Missing** |
| 5 | `rejectionReason` | Rejection Reason | ❌ | **Missing** |
| 6 | `inspectionStatus` | Inspection Status | ❌ | **Missing** |
| 7 | `remarks` | Remarks | ❌ | **Missing** |

---

## 16. Auction Lifecycle (from `editForm` in `confirmQCApproval`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `auctionStartTime` | Auction Start Time | ❌ | **Missing** |
| 2 | `auctionDuration` | Auction Duration | ❌ | **Missing** |
| 3 | `auctionEndTime` | Auction End Time | ❌ | **Missing** |
| 4 | `auctionStatus` | Auction Status | ❌ | **Missing** |
| 5 | `sendToAuctionApk` | Sent to Auction APK | ❌ | **Missing** |

---

## 17. Contact / Customer (from `editForm`)

| # | Field Key | Label | In PDF? | Notes |
|---|-----------|-------|---------|-------|
| 1 | `customerContactNumber` / `contactNumber` | Customer Contact | ❌ | **Missing** |

---

## Summary: Delta (Missing Fields)

### High-Impact Missing Fields (should likely appear in PDF)

- [ ] `registrationNumber` — Vehicle reg plate
- [ ] `registrationDate` — Reg date
- [ ] `registeredOwner` — Owner name
- [ ] `ownerSerialNumber` — 1st/2nd/3rd owner
- [ ] `odometerReadingInKms` — KMs driven
- [ ] `appointmentId` — Inspection ID
- [ ] **All 18 Interior `isFourPanel` fields** — Airbags (12 fields), Seats & Upholstery (6 fields) are completely missing because the PDF template has no rendering branch for `isFourPanel` parts
- [ ] `priceDiscovery` — Valuation price
- [ ] `approvalStatus` — QC status
- [ ] `approvedBy` — QC reviewer
- [ ] `approvalDate` + `approvalTime` — When approved

### Medium-Impact Missing Fields

- [ ] `appointmentSource` — Lead source
- [ ] `inspectionStatus` — Inspection status
- [ ] `customerContactNumber` — Customer phone
- [ ] `retailAssociate` — Assigned retailer
- [ ] `retailAssociateContactNumber` — Retailer phone
- [ ] `priceDiscoveryBy` — Who set the price
- [ ] `rejectionReason` / `remarks` — If rejected

### Low-Impact / Structural

- [ ] `auctionStartTime`, `auctionEndTime`, `auctionDuration`, `auctionStatus` — Auction metadata
- [ ] `sendToAuctionApk` — API timestamp
- [ ] `engineVideo`, `exhaustSmokeVideo` — Cannot render in static PDF (expected)
- [ ] `imageGroups` sub-images — PDF only renders `imageKey`/first image, not multi-angle `imageGroups` arrays (affects Bonnet, Front/Rear Bumper, Boot Door, LHS/RHS Quarter Panel)

### Total Counts

| Category | Total Fields | In PDF | Missing |
|----------|-------------|--------|---------|
| Vehicle Identity | 14 | 4 | **10** |
| Registration/Tech Specs | 11 | 11 | 0 |
| Insurance/Hypothecation | 6 | 6 | 0 |
| Documents/Compliance | 17 | 17 | 0 |
| Exterior (Front) | 10 | 10 | 0 |
| Exterior (LHS) | 14 | 14 | 0 |
| Exterior (Rear) | 11 | 11 | 0 |
| Exterior (RHS) | 14 | 14 | 0 |
| Engine Bay | 25 | 24 | **1** |
| Electricals/AC | 22 | 22 | 0 |
| Interior | 21 | 3 | **18** |
| Steering/Suspension/Brakes | 9 | 9 | 0 |
| Engine Videos | 2 | 0 | **2** |
| Valuation/Pricing | 4 | 0 | **4** |
| QC/Approval Metadata | 7 | 0 | **7** |
| Auction Lifecycle | 5 | 0 | **5** |
| Contact/Customer | 1 | 0 | **1** |
| **TOTAL** | **193** | **145** | **48** |
