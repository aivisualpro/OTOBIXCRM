import re
import sys

file_path = "/Users/adeeljabbar/Downloads/Code Library/Otobix-CRM/app/components/CarInspectionView.vue"
with open(file_path, "r") as f:
    content = f.read()

# Fields to remove any 'old: ...' or 'oldKey: ...' or 'oldImageKey: ...' from
fields = [
    "vinPlateDetails", "vinPlateImages", "seatingCapacity", "color", "norms", "roadTaxImages", 
    "hypothecatedTo", "insurer", "pucValidity", "pucNumber", "pucImages", "rcStatus", "blacklistStatus",
    "frontWiperAndWasherDropdownList", "frontWiperAndWasherImages", "lhsRearFogLampDropdownList", 
    "lhsRearFogLampImages", "rhsRearFogLampDropdownList", "rhsRearFogLampImages", "spareWheelDropdownList", 
    "spareWheelImages", "cowlTopImages", "firewallImages", "lhsSideMemberDropdownList", "rhsSideMemberDropdownList",
    "commentsOnClusterMeterDropdownList", "irvm", "dashboardDropdownList", "acImages", "rearWiperAndWasherImages", 
    "reverseCameraImages", "driverSideKneeAirbag", "coDriverKneeSeatAirbag", "driverSeatDropdownList", 
    "coDriverSeatDropdownList", "frontCentreArmRestDropdownList", "rearSeatsDropdownList", "thirdRowSeatsDropdownList",
    "transmissionTypeDropdownList", "driveTrainDropdownList", "odometerReadingAfterTestDriveInKms", 
    "odometerReadingAfterTestDriveImages"
]

lines = content.split('\n')
for i, line in enumerate(lines):
    should_process = False
    for field in fields:
        if field in line:
            should_process = True
            break
    
    if should_process:
        # Regex to remove old: 'something', old: undefined, oldKey: 'something', etc.
        # It handles optional quotes and undefined
        line = re.sub(r",\s*old:\s*(?:'[^']*'|undefined)", "", line)
        line = re.sub(r",\s*oldKey:\s*(?:'[^']*'|undefined)", "", line)
        line = re.sub(r",\s*oldImageKey:\s*(?:'[^']*'|undefined)", "", line)
        lines[i] = line

with open(file_path, "w") as f:
    f.write('\n'.join(lines))

print("Keys fixed successfully.")
