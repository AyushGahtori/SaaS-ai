//import superjson from 'superjson';
import {
    defaultShouldDehydrateQuery,
    QueryClient,
} from '@tanstack/react-query';

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000,
            },
            dehydrate: {
                //serializeData: superjson.serialize,
                shouldDehydrateQuery: (query: any) =>
                    defaultShouldDehydrateQuery(query) ||
                    query.state.status === 'pending',
            },
            hydrate: {
                //deserializeData: superjson.deserialize,
            },
        },
    });
}

let clientQueryClientSingleton: QueryClient | undefined;

export function getQueryClient() {
    if (typeof window === 'undefined') {
        return makeQueryClient();
    }

    if (!clientQueryClientSingleton) {
        clientQueryClientSingleton = makeQueryClient();
    }

    return clientQueryClientSingleton;
}