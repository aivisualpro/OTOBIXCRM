// GET /api/leads/last-approved-retailer — Fetch the retailAssociateContactNumber from the last car record
// Optional query param: ?retailAssociate=<email> to filter by a specific retailer
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const db = await getLeadsDb(event)

    const filter: Record<string, any> = {
      retailAssociateContactNumber: { $exists: true, $ne: '' },
    }

    // If a specific retailAssociate is requested, filter by it
    if (query.retailAssociate) {
      filter.retailAssociate = query.retailAssociate
    } else {
      filter.approvalStatus = 'Approved'
    }

    const doc = await db.collection('cars')
      .find(filter)
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
