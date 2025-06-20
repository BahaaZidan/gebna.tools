<script lang="ts">
	import { SettingsIcon } from '@lucide/svelte';
	import { onMount } from 'svelte';

	import { graphql } from '$houdini';

	import { route } from '$lib/__generated__/routes';
	import { signOut } from '$lib/client/auth';
	import Comment from '$lib/components/Comment.svelte';
	import { fromGlobalId } from '$lib/global-id-utils';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = graphql(`
		query BigWebsiteQuery($websiteId: ID!, $pageInput: PageInput!) {
			website(id: $websiteId) {
				id
				name
				owner {
					id
				}
				preModeration
				page(input: $pageInput) {
					id
					preModeration
					closed
					url
					comments(first: 10) @paginate(name: "Embed_Comments") {
						edges {
							node {
								id
								content
								createdAt
								published
								author {
									id
									name
									image
								}
							}
						}
					}
				}
			}
		}
	`);
	onMount(async () => {
		await query.fetch({ variables: data.queryVariables });
	});

	let website = $derived($query.data?.website);

	let permissions = $derived({
		create: !!data.session?.user && !website?.page?.closed,
		publish:
			website?.owner.id === data.session?.user.id ||
			(!website?.preModeration && !website?.page?.preModeration),
	});

	let loggedInUserId = $derived(data.session?.user.id);
	let websitesOwnedByLoggedInUser = $derived(data.session?.websitesOwnedByCurrentUser || []);
	let isWebsiteOwner = $derived(
		website?.id ? websitesOwnedByLoggedInUser.includes(Number(fromGlobalId(website.id).id)) : false
	);

	function sendHeight() {
		const height = document.body.scrollHeight;
		window.parent.postMessage(
			{
				type: 'resize',
				height: height,
			},
			'*'
		);
	}

	onMount(() => {
		window.addEventListener('load', sendHeight);
		const observer = new MutationObserver(sendHeight);
		observer.observe(document.body, { childList: true, subtree: true, attributes: true });
	});

	let commentValue = $state('');

	const CreateComment = graphql(`
		mutation CreateComment($input: CreateCommentInput!) {
			createComment(input: $input) {
				id
				content
				createdAt
				...Embed_Comments_insert @prepend
			}
		}
	`);

	const TogglePageClosed = graphql(`
		mutation TogglePageClosed($id: ID!) {
			togglePageClosed(id: $id) {
				id
				closed
			}
		}
	`);

	const TogglePagePreModeration = graphql(`
		mutation TogglePagePreModeration($id: ID!) {
			togglePagePreModeration(id: $id) {
				id
				preModeration
			}
		}
	`);
</script>

<div class="flex flex-col items-center gap-2">
	<div class="flex w-full items-center justify-between">
		{#if data.session}
			<div class="flex items-center gap-1">
				<div>
					Logged in as <b>{data.session.user.name}</b>
				</div>
				{#if website && isWebsiteOwner}
					<details class="dropdown">
						<summary class="btn btn-sm btn-warning m-1"><SettingsIcon size={18} /></summary>
						<ul class="menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
							<div class="mb-2 pl-2 font-bold">Page Settings</div>
							<li>
								<label class="label">
									<input
										type="checkbox"
										checked={website.page.closed}
										class="toggle"
										disabled={$TogglePageClosed.fetching}
										onchange={() => {
											TogglePageClosed.mutate({ id: website.page.id });
										}}
									/>
									Closed
								</label>
							</li>
							<li>
								<label class="label">
									<input
										type="checkbox"
										checked={website.page.preModeration}
										class="toggle"
										disabled={$TogglePagePreModeration.fetching}
										onchange={() => {
											TogglePagePreModeration.mutate({ id: website.page.id });
										}}
									/>
									Pre Moderation
								</label>
							</li>
						</ul>
					</details>
				{/if}
			</div>
			<button class="btn btn-ghost" onclick={signOut}>Logout</button>
		{:else}
			<span>
				You must <a
					class="link font-bold"
					target="_top"
					href="{route('/embeds/login')}?callback_url={website?.page?.url}"
				>
					login
				</a>
				to comment
			</span>
		{/if}
	</div>
	<div class="flex w-full flex-col items-end gap-2">
		<label class="floating-label w-full">
			<textarea
				placeholder="Comment"
				class="textarea w-full"
				bind:value={commentValue}
				disabled={!permissions.create}
			></textarea>
			<span>Comment</span>
		</label>
		<button
			class="btn"
			onclick={async () => {
				if (!website) return;
				await CreateComment.mutate({
					input: { pageId: website.page.id, content: commentValue },
				});
				commentValue = '';
			}}
		>
			Submit
		</button>
	</div>
	{#if website}
		<div class="flex w-full flex-col gap-4 px-2">
			{#each website.page.comments.edges as { node } (node.id)}
				<Comment
					{...node}
					permissions={{
						delete: fromGlobalId(node.author.id).id === loggedInUserId || isWebsiteOwner,
						edit: fromGlobalId(node.author.id).id === loggedInUserId,
						approve: !node.published && isWebsiteOwner,
					}}
				/>
			{/each}

			<button
				class="btn"
				onclick={() => query.loadNextPage()}
				disabled={!$query.pageInfo.hasNextPage || $query.fetching}
			>
				{#if $query.fetching}
					Loading more...
				{:else if $query.pageInfo.hasNextPage}
					Load More
				{:else}Nothing more to load{/if}
			</button>
		</div>
	{/if}
	<span class="py-6">
		Powered by <a href="https://gebna.tools/" class="link-hover font-bold">gebna.tools</a>
	</span>
</div>

<style>
	:root {
		background: transparent !important;
	}
</style>
