// DELETE /api/workspaces — delete a workspace by workspaceId
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    if (!body?.workspaceId) {
      throw createError({ statusCode: 400, message: 'workspaceId is required' })
    }

    // Protected workspaces can't be deleted
    if (body.workspaceId === 'admin') {
      throw createError({ statusCode: 403, message: 'Cannot delete the Admin workspace' })
    }

    const db = await getLeadsDb(event)
    const collection = db.collection('workspaces')

    const ws = await collection.findOne({ workspaceId: body.workspaceId })
    if (!ws) {
      throw createError({ statusCode: 404, message: 'Workspace not found' })
    }

    if (ws.isProtected) {
      throw createError({ statusCode: 403, message: 'Cannot delete a protected workspace' })
    }

    await collection.deleteOne({ workspaceId: body.workspaceId })

    return {
      success: true,
      message: 'Workspace deleted successfully',
    }
  }
  catch (err: any) {
    if (err.statusCode)
      throw err
    console.error('[API:workspaces] DELETE failed:', err.message)
    throw createError({ statusCode: 500, message: err.message || 'Failed to delete workspace' })
  }
})
