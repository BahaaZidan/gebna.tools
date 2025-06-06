import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';

import type { Session } from './auth';
import { db } from './db';
import { commentTable, pageTable, userTable, websiteTable } from './db/schema';

export async function fetchPageComments(
	pageId: number,
	loggedInUserId?: string,
	publishedOnly: boolean = false
) {
	const page = (
		await db
			.select({
				id: pageTable.id,
				closed: pageTable.closed,
				website: {
					id: websiteTable.id,
					ownerId: websiteTable.ownerId,
				},
			})
			.from(pageTable)
			.where(eq(pageTable.id, pageId))
			.leftJoin(websiteTable, eq(pageTable.websiteId, websiteTable.id))
			.limit(1)
	)[0];

	if (!page) return error(404);

	const commentsResult = await db
		.select({
			id: commentTable.id,
			content: commentTable.content,
			createdAt: commentTable.createdAt,
			published: commentTable.published,
			author: {
				id: userTable.id,
				name: userTable.name,
				image: userTable.image,
			},
		})
		.from(commentTable)
		.orderBy(desc(commentTable.createdAt))
		.where(
			publishedOnly
				? and(eq(commentTable.pageId, pageId), eq(commentTable.published, true))
				: eq(commentTable.pageId, pageId)
		)
		.leftJoin(userTable, eq(commentTable.authorId, userTable.id));

	const comments = commentsResult.map((c) => ({
		id: c.id,
		content: c.content,
		createdAt: c.createdAt,
		published: c.published,
		author: c.author,
		permissions: {
			delete: c.author?.id === loggedInUserId || page.website?.ownerId === loggedInUserId,
			edit: c.author?.id === loggedInUserId,
			approve: !c.published && page.website?.ownerId === loggedInUserId,
		},
	}));

	return {
		comments,
		permissions: {
			create: !!loggedInUserId && !page.closed,
		},
	};
}

export async function fetchUnpublishedUserCommentsByPage(
	pageId: number,
	loggedInUser?: Session['user']
) {
	if (!loggedInUser) return [];
	const commentsResult = await db
		.select({
			id: commentTable.id,
			content: commentTable.content,
			createdAt: commentTable.createdAt,
			published: commentTable.published,
		})
		.from(commentTable)
		.orderBy(desc(commentTable.createdAt))
		.where(
			and(
				eq(commentTable.pageId, pageId),
				eq(commentTable.published, false),
				eq(commentTable.authorId, loggedInUser.id)
			)
		);

	const comments = commentsResult.map((c) => ({
		id: c.id,
		content: c.content,
		createdAt: c.createdAt,
		published: c.published,
		author: loggedInUser,
		permissions: {
			delete: true,
			edit: true,
			approve: false,
		},
	}));

	return comments;
}
