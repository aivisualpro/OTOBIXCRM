// GET /api/leads/last-approved-retailer — Fetch the retailAssociateContactNumber from the last Approved car
export default defineEventHandler(async (event) => {
  try {
    const db = await getLeadsDb(event)
    const doc = await db.collection('telecallings')
      .find({ approvalStatus: 'Approved', retailAssociateContactNumber: { $exists: true, $ne: '' } })
      .sort({ _id: -1 })
      .limit(1)
      .project({ retailAssociate: 1, retailAssociateContactNumber: 1 })
      .toArray()

    if (doc.length > 0) {
      return {
        retailAssociate: doc[0].retailAssociate || '',
        retailAssociateContactNumber: doc[0].retailAssociateContactNumber || '',
      }
    }
    return { retailAssociate: '', retailAssociateContactNumber: '' }
  }
  catch (err: any) {
    console.error('[API:leads] last-approved-retailer failed:', err.message)
    return { retailAssociate: '', retailAssociateContactNumber: '' }
  }
})
